# -*- coding: utf-8 -*-
"""KI-Veredelungs-Pass fuer Village-Wars-Sprites (Stable Diffusion img2img,
DreamShaper-8, DirectML-GPU) — Regeln aus CLAUDE.md:
  * Prompts werden AUSSCHLIESSLICH aus PROMPT_TEMPLATES.md gebaut (nie frei!)
  * ART_STYLE.md ist oberste Instanz (Chibi, Cel-Shading, Fraktionsfarben)
  * FESTER Seed fuer Reproduzierbarkeit
  * IP-Adapter (h94/IP-Adapter, SD1.5) fuer Schritt B: Referenz-Sheet als
    Bildinput, damit Posen konsistent zum abgesegneten Sheet bleiben

Aufruf:
  python gen_ai_pass.py <in.png> <out.png> <unit> <step> [strength] [ref.png]
    unit:  archer | militia | ... (Abschnitt in PROMPT_TEMPLATES.md)
    step:  sheet (Schritt A) | pose:<Name> (Schritt B, braucht ref.png) | smoketest
  python gen_ai_pass.py smoketest        (nur Pipeline+IP-Adapter laden/downloaden)

Hinweis: SD-1.5-CLIP schneidet Prompts nach 77 Tokens ab — die Design-Details
am Prompt-Ende wirken nur teilweise; Farben/Ausruestung kommen primaer aus der
Blender-Geometrie.
"""
import os, re, sys, time

TPL = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                   "..", "..", "PROMPT_TEMPLATES.md")
SEED = 47                    # FESTER Seed (CLAUDE.md: Reproduzierbarkeit)
IP_REPO = "h94/IP-Adapter"
IP_WEIGHT = "ip-adapter_sd15.bin"
UNIT_HEADINGS = {"archer": "Archer", "militia": "Militia"}


def load_templates(unit, step):
    """Baut den Prompt 1:1 aus PROMPT_TEMPLATES.md: Basis-Stilblock (Sektion 0)
    + Einheiten-Template (Schritt A oder B) + Negativ-Prompt."""
    md = open(TPL, encoding="utf-8").read()
    sec0 = md.split("## 0.")[1].split("\n## ")[0]
    fences0 = re.findall(r"```\s*\n(.*?)```", sec0, re.S)
    style = " ".join(fences0[0].split())
    neg = " ".join(fences0[1].split())
    # Kurzfassung (3. Fence in Sektion 0) fuer 77-Token-Tools: Stil ZUERST
    style_short = " ".join(fences0[2].split()) if len(fences0) > 2 else None
    head = UNIT_HEADINGS.get(unit, unit.capitalize())
    parts = re.split(r"##\s+\d+\.[^\n]*" + re.escape(head), md)
    if len(parts) < 2:
        raise SystemExit(f"Einheit '{unit}' nicht in PROMPT_TEMPLATES.md gefunden")
    sec_u = parts[1].split("\n## ")[0]
    fences_u = re.findall(r"```\s*\n(.*?)```", sec_u, re.S)
    if step == "sheet":
        tpl = fences_u[0]
    else:                                   # pose:<Name>
        tpl = fences_u[1]
        pose_name = step.split(":", 1)[1]
        m = re.search(r'-\s*' + pose_name + r':\s*"([^"]+)"', sec_u)
        if not m:
            raise SystemExit(f"Pose '{pose_name}' nicht in der Posen-Bibliothek")
        tpl = tpl.replace("{POSE}", " ".join(m.group(1).split()))
        tpl = re.sub(r"\[Bildinput:[^\]]*\]", "", tpl)   # Kommentarzeile, kein Prompt
    if style_short:
        # SD-1.5-Regel aus PROMPT_TEMPLATES.md: Kurz-Stilblock an den ANFANG,
        # Einheiten-Template ohne Platzhalter dahinter
        body_txt = " ".join(tpl.replace("{BASIS-STILBLOCK}", "").split())
        body_txt = re.sub(r"\s*,\s*,+", ",", body_txt)
        prompt = style_short + ", " + body_txt
    else:
        prompt = " ".join(tpl.replace("{BASIS-STILBLOCK}", style).split())
    return prompt, neg


def build_pipe(need_ip):
    import torch
    try:
        import torch_directml
        device = torch_directml.device()
        print("GPU:", torch_directml.device_name(0))
    except Exception as e:
        device = "cpu"
        print("CPU-Fallback:", e)
    from diffusers import StableDiffusionImg2ImgPipeline, DPMSolverMultistepScheduler
    t0 = time.time()
    pipe = StableDiffusionImg2ImgPipeline.from_pretrained(
        "Lykon/dreamshaper-8",
        torch_dtype=(torch.float16 if device != "cpu" else torch.float32),
        safety_checker=None, requires_safety_checker=False)
    pipe.scheduler = DPMSolverMultistepScheduler.from_config(
        pipe.scheduler.config, use_karras_sigmas=True, algorithm_type="dpmsolver++",
        final_sigmas_type="sigma_min")
    if need_ip:
        # IP-Adapter: Referenz-Sheet als Bild-Kondition (Schritt B / Konsistenz)
        pipe.load_ip_adapter(IP_REPO, subfolder="models", weight_name=IP_WEIGHT)
        print("IP-Adapter geladen:", IP_WEIGHT)
    pipe = pipe.to(device)
    # FALLE: attention_slicing ERSETZT die IPAdapter-AttnProcessors -> Crash
    # ('tuple' object has no attribute 'shape'). Mit IP-Adapter nur VAE slicen.
    if not need_ip:
        pipe.enable_attention_slicing()
    pipe.enable_vae_slicing()
    print("Pipeline bereit in", round(time.time() - t0, 1), "s")
    return pipe, device


def main():
    if sys.argv[1] == "smoketest":
        pipe, _ = build_pipe(need_ip=True)
        print("SMOKETEST OK — Pipeline + IP-Adapter geladen")
        return
    import torch
    from PIL import Image, ImageFilter
    src, dst, unit, step = sys.argv[1:5]
    strength = float(sys.argv[5]) if len(sys.argv) > 5 else 0.55
    ref_path = sys.argv[6] if len(sys.argv) > 6 else None
    if step.startswith("pose") and not ref_path:
        raise SystemExit("Schritt B (pose) braucht das Referenz-Sheet als ref.png!")

    prompt, neg = load_templates(unit, step)
    print("PROMPT:", prompt[:160], "...")

    init = Image.open(src).convert("RGBA")
    n_tiles = max(1, round(init.size[0] / init.size[1]))
    # IP-Adapter auch im Sheet-Modus (Selbst-Referenz fuer Ansichts-Konsistenz)
    pipe, device = build_pipe(need_ip=bool(ref_path) or n_tiles > 1)

    kw = {}
    if ref_path:
        kw["ip_adapter_image"] = Image.open(ref_path).convert("RGB")
        pipe.set_ip_adapter_scale(0.65)
    elif n_tiles > 1:
        # SHEET-KONSISTENZ: ohne Anker erfindet jede Kachel eigene Details
        # (Bart nur vorn, weisse Hosen, Embleme). Die Front-Ansicht der QUELLE
        # dient allen Kacheln als IP-Adapter-Identitaets-Referenz.
        tw0 = init.size[0] // n_tiles
        ref0 = Image.new("RGBA", (tw0, init.size[1]), (255, 255, 255, 255))
        ref0.alpha_composite(init.crop((0, 0, tw0, init.size[1])))
        kw["ip_adapter_image"] = ref0.convert("RGB")
        pipe.set_ip_adapter_scale(0.6)

    def run_one(tile_rgba):
        """Ein Einzelbild durch img2img; Alpha der Quelle kommt zurueck.
        Mit IP-Adapter ist attention_slicing aus -> 768 sprengt den VRAM,
        640 halbiert den Attention-Speicher."""
        SIZE = 640 if "ip_adapter_image" in kw else 768
        bg = Image.new("RGBA", tile_rgba.size, (255, 255, 255, 255))
        bg.alpha_composite(tile_rgba)
        rgb = bg.convert("RGB").resize((SIZE, SIZE), Image.LANCZOS)
        gen = torch.Generator("cpu").manual_seed(SEED)
        o = pipe(prompt=prompt, negative_prompt=neg, image=rgb,
                 strength=strength, guidance_scale=7.0,
                 num_inference_steps=30, generator=gen, **kw).images[0]
        alpha = tile_rgba.split()[3].resize((SIZE, SIZE), Image.LANCZOS)
        alpha = alpha.point(lambda v: 0 if v < 100 else v)
        alpha = alpha.filter(ImageFilter.MaxFilter(3))
        o = o.convert("RGBA")
        o.putalpha(alpha)
        return o

    t0 = time.time()
    if n_tiles > 1:
        # Sheet: 2048x512 sprengt den DML-Speicher (2GB-Tensor) -> jede Ansicht
        # einzeln mit IDENTISCHEM Seed+Prompt, danach wieder montieren
        tw = init.size[0] // n_tiles
        outs = []
        for i in range(n_tiles):
            tile = init.crop((i * tw, 0, (i + 1) * tw, init.size[1]))
            outs.append(run_one(tile))
            print(f"  Kachel {i + 1}/{n_tiles} fertig")
        out = Image.new("RGBA", (768 * n_tiles, 768), (0, 0, 0, 0))
        for i, o in enumerate(outs):
            out.paste(o, (i * 768, 0))
    else:
        out = run_one(init)
    print("Generiert in", round(time.time() - t0, 1), "s | Seed", SEED,
          "| Strength", strength, "| Kacheln:", n_tiles)
    out.save(dst)
    print("SAVED", dst)


main()

from pathlib import Path
from PIL import Image
import shutil

src = Path(r"C:\Users\于翔\.grok\sessions\F%3A%5CDocProject%5Cairp-desktop\01a0058b-0259-7641-b822-1955857c7d34\images")
root = Path(r"F:\DocProject\airp-desktop")
art = root / "src" / "assets" / "art"
worlds = art / "worlds"
art.mkdir(parents=True, exist_ok=True)
worlds.mkdir(exist_ok=True)

copies = {
    "2.jpg": art / "welcome.jpg",
    "17.jpg": art / "paper.jpg",
    "18.jpg": art / "empty.jpg",
    "19.jpg": art / "create.jpg",
    "6.jpg": worlds / "cultivation.jpg",
    "5.jpg": worlds / "fantasy.jpg",
    "7.jpg": worlds / "urban.jpg",
    "12.jpg": worlds / "infinite.jpg",
    "9.jpg": worlds / "apocalypse.jpg",
    "8.jpg": worlds / "scifi.jpg",
    "4.jpg": worlds / "folklore.jpg",
    "10.jpg": worlds / "rulehorror.jpg",
    "13.jpg": worlds / "palace.jpg",
    "11.jpg": worlds / "zhaidou.jpg",
    "16.jpg": worlds / "retro.jpg",
    "15.jpg": worlds / "romance.jpg",
    "14.jpg": worlds / "entertainment.jpg",
}
for a, b in copies.items():
    shutil.copy2(src / a, b)
    print("copy", a, "->", b.name)

icon = Image.open(src / "3.jpg").convert("RGBA")
icons = root / "src-tauri" / "icons"
icon.save(icons / "icon.png")
for size, name in [(32, "32x32.png"), (64, "64x64.png"), (128, "128x128.png"), (256, "128x128@2x.png")]:
    icon.resize((size, size), Image.Resampling.LANCZOS).save(icons / name)
icon.save(icons / "icon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print("desktop icons written")

res = root / "src-tauri" / "gen" / "android" / "app" / "src" / "main" / "res"
dens = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
for d, px in dens.items():
    folder = res / f"mipmap-{d}"
    folder.mkdir(exist_ok=True)
    im = icon.resize((px, px), Image.Resampling.LANCZOS)
    for name in ("ic_launcher.png", "ic_launcher_round.png", "ic_launcher_foreground.png"):
        im.save(folder / name)
    print("android", d, px)
print("done")

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

asset_dir = Path('/home/ubuntu/webdev-static-assets')
files = sorted(asset_dir.glob('joan-live-product-*.*'))
files = [path for path in files if path.suffix.lower() in {'.jpg', '.jpeg', '.png', '.webp'}]
thumb_w, thumb_h, label_h, cols = 150, 130, 22, 5
rows = (len(files) + cols - 1) // cols
sheet = Image.new('RGB', (cols * thumb_w, rows * (thumb_h + label_h)), 'white')
draw = ImageDraw.Draw(sheet)
font = ImageFont.load_default()

for index, path in enumerate(files):
    image = Image.open(path).convert('RGB')
    image.thumbnail((thumb_w - 12, thumb_h - 12))
    x = (index % cols) * thumb_w
    y = (index // cols) * (thumb_h + label_h)
    sheet.paste(image, (x + (thumb_w - image.width) // 2, y + (thumb_h - image.height) // 2))
    draw.rectangle((x, y + thumb_h, x + thumb_w, y + thumb_h + label_h), fill='#202728')
    draw.text((x + 6, y + thumb_h + 5), path.stem.replace('joan-live-product-', ''), fill='white', font=font)

sheet.save(asset_dir / 'joan-live-product-contact-sheet.jpg', quality=90)

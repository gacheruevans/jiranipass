import zlib
import struct
from pathlib import Path

def create_png(width, height, color_bg=(37, 99, 235), color_fg=(255, 255, 255)):
    # Simple PNG generator with blue background and white badge center
    raw_data = bytearray()
    for y in range(height):
        raw_data.append(0) # Filter byte 0 (None)
        for x in range(width):
            # Border radius / circle check
            dx = abs(x - width // 2)
            dy = abs(y - height // 2)
            
            # Simple rounded square or letter J shape
            if (width * 0.45 <= x <= width * 0.55 and height * 0.25 <= y <= height * 0.65) or \
               (width * 0.35 <= x <= width * 0.55 and height * 0.60 <= y <= height * 0.75):
                raw_data.extend(color_fg)
            else:
                raw_data.extend(color_bg)

    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)

    png_header = b'\x89PNG\r\n\x1a\n'
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)
    ihdr = chunk(b'IHDR', ihdr_data)
    idat = chunk(b'IDAT', zlib.compress(bytes(raw_data)))
    iend = chunk(b'IEND', b'')

    return png_header + ihdr + idat + iend

public_dir = Path("/Users/egacheru/Projects/Personal/jiranipass/apps/web/public")
public_dir.mkdir(parents=True, exist_ok=True)

with open(public_dir / "icon-192.png", "wb") as f:
    f.write(create_png(192, 192))

with open(public_dir / "icon-512.png", "wb") as f:
    f.write(create_png(512, 512))

# Also copy into apps/mobile/assets if needed
mobile_assets = Path("/Users/egacheru/Projects/Personal/jiranipass/apps/mobile/assets")
mobile_assets.mkdir(parents=True, exist_ok=True)
with open(mobile_assets / "icon.png", "wb") as f:
    f.write(create_png(512, 512))
with open(mobile_assets / "favicon.png", "wb") as f:
    f.write(create_png(192, 192))

print("✅ PNG icons successfully generated!")

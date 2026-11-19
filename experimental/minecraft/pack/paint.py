"""Small helpers for painting Minecraft entity textures from code.

Minecraft unwraps every model box (texture offset u, v; size w, h, d) the same way:

        [ top w*d ][ bottom w*d ]
  [ side d*h ][ front w*h ][ side d*h ][ back w*h ]

so a texture can be painted face by face from the model's box list, without starting from
Mojang's art. Colours get a little seeded per-pixel noise so flat areas read as fur or cloth.
"""
import random
from PIL import Image


def hexrgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


class Tex:
    def __init__(self, w, h, seed=1):
        self.im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        self.px = self.im.load()
        self.rng = random.Random(seed)

    def dot(self, x, y, colour, noise=0):
        if not (0 <= x < self.im.width and 0 <= y < self.im.height):
            return
        r, g, b = hexrgb(colour) if isinstance(colour, str) else colour
        if noise:
            k = self.rng.uniform(-noise, noise)
            r, g, b = (max(0, min(255, int(c * (1 + k)))) for c in (r, g, b))
        self.px[x, y] = (r, g, b, 255)

    def rect(self, x, y, w, h, colour, noise=0.06):
        for j in range(y, y + h):
            for i in range(x, x + w):
                self.dot(i, j, colour, noise)

    def clear(self, x, y, w, h):
        for j in range(y, y + h):
            for i in range(x, x + w):
                if 0 <= i < self.im.width and 0 <= j < self.im.height:
                    self.px[i, j] = (0, 0, 0, 0)

    def box(self, u, v, w, h, d, colour, noise=0.06):
        """Paint every face of a box one colour; returns the face rectangles for detail work."""
        f = faces(u, v, w, h, d)
        for x, y, fw, fh in f.values():
            self.rect(x, y, fw, fh, colour, noise)
        return f

    def save(self, path):
        path.parent.mkdir(parents=True, exist_ok=True)
        self.im.save(path)


def faces(u, v, w, h, d):
    """Face rectangles (x, y, width, height) of a box's unwrap. 'right' sits left of 'front' in the
    texture; its last column, and 'left''s first column, touch the front face."""
    return {
        'top': (u + d, v, w, d), 'bottom': (u + d + w, v, w, d),
        'right': (u, v + d, d, h), 'front': (u + d, v + d, w, h),
        'left': (u + d + w, v + d, d, h), 'back': (u + 2 * d + w, v + d, w, h),
    }

#!/usr/bin/env python3
"""
Skærer produktbilleder ud til Bestil-listen (kræver Pillow).

Fjerner hvid/lys baggrund (flood fill fra kanten, så hvide dåser ikke forsvinder),
beskærer til selve produktet og lægger det centreret på et kvadratisk, gennemsigtigt
lærred med luft omkring.

Ét produkt:
    python3 tools/udskaer.py ud.webp kilde.jpg
Flere produkter side om side (fx sodavand):
    python3 tools/udskaer.py ud.webp kilde1.webp kilde2.webp

Valg:
    --luft 1.35   hvor meget luft rundt om (1.0 = produktet fylder hele billedet)
    --str 256     størrelse i pixels (kvadratisk)
"""
import argparse
from collections import deque
from PIL import Image, ImageFilter, ImageOps


def udskaer(sti, taerskel=232):
    im = ImageOps.expand(Image.open(sti).convert('RGBA'), border=12, fill=(255, 255, 255, 255))
    w, h = im.size
    px = im.load()
    maske = Image.new('L', (w, h), 255)
    mp = maske.load()
    set_ = bytearray(w * h)
    q = deque([(0, 0)])
    while q:
        x, y = q.popleft()
        i = y * w + x
        if set_[i]:
            continue
        set_[i] = 1
        p = px[x, y]
        if not (p[0] > taerskel and p[1] > taerskel and p[2] > taerskel and p[3] > 0) and p[3] != 0:
            continue
        mp[x, y] = 0
        if x > 0: q.append((x - 1, y))
        if x < w - 1: q.append((x + 1, y))
        if y > 0: q.append((x, y - 1))
        if y < h - 1: q.append((x, y + 1))
    # Beskær til selve produktet (fjerner tynde streger i billedkanten)
    kol = [x for x in range(w) if sum(1 for y in range(0, h, 2) if mp[x, y] > 0) > 0.3 * (h / 2)]
    rk = [y for y in range(h) if sum(1 for x in range(0, w, 2) if mp[x, y] > 0) > 0.15 * (w / 2)]
    x0, x1, y0, y1 = kol[0], kol[-1] + 1, rk[0], rk[-1] + 1
    for x in range(w):
        for y in range(h):
            if x < x0 or x >= x1 or y < y0 or y >= y1:
                mp[x, y] = 0
    maske = maske.filter(ImageFilter.GaussianBlur(1.2))
    im.putalpha(maske)
    return im.crop((x0 - 3, y0 - 3, x1 + 3, y1 + 3))


def saml(billeder, overlap=0.12):
    # Samme højde, side om side med lidt overlap
    hoejde = max(b.size[1] for b in billeder)
    skal = [b.resize((round(b.size[0] * hoejde / b.size[1]), hoejde), Image.LANCZOS) for b in billeder]
    bredde = sum(b.size[0] for b in skal) - int(overlap * skal[0].size[0]) * (len(skal) - 1)
    ud = Image.new('RGBA', (bredde, hoejde), (0, 0, 0, 0))
    x = 0
    for b in skal:
        ud.paste(b, (x, 0), b)
        x += b.size[0] - int(overlap * b.size[0])
    return ud


def main():
    a = argparse.ArgumentParser()
    a.add_argument('ud')
    a.add_argument('kilder', nargs='+')
    a.add_argument('--luft', type=float, default=1.35)
    a.add_argument('--str', type=int, default=256)
    v = a.parse_args()
    dele = [udskaer(k) for k in v.kilder]
    prod = dele[0] if len(dele) == 1 else saml(dele)
    cw, ch = prod.size
    side = int(max(cw, ch) * v.luft)
    laerred = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    laerred.paste(prod, ((side - cw) // 2, (side - ch) // 2), prod)
    laerred.resize((v.str, v.str), Image.LANCZOS).save(v.ud, 'WEBP', quality=88, method=6)
    print('Gemt', v.ud)


if __name__ == '__main__':
    main()

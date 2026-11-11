"""Build selected CC0 effects from the reference manifest; no downloads required."""
import argparse
import contextlib
import io
import json
import re
import tempfile
from pathlib import Path

from PIL import Image, ImageChops, ImageOps
from optimize_images import convert

ROOT = Path(__file__).resolve().parents[1]


def selected(packs):
    by_slug = {p['slug']: p for p in packs}
    result = []

    def add(slug, category, limit=None, kind=None, names=None):
        pack = by_slug[slug]
        effects = [e for e in pack['effects'] if (kind is None or e['kind'] == kind)
                   and (names is None or any(n in e['name'] for n in names))]
        for effect in effects[:limit]:
            result.append((pack, effect, category))

    add('2dfx-impact-spritesheets', 'impact')
    add('70-animated-2d-game-effects', 'impact', 22)
    add('weapon-slash-effect', 'slash', 20)
    add('water-magic-effect', 'water')
    add('nature-magic-effect', 'nature')
    add('arcane-magic-effect', 'arcane')
    add('light-magic-effect', 'light')
    add('2d-spell-effects', 'fire', kind='frames', names=['swordFire', 'fireBall', 'sign_of_fire'])
    add('2d-spell-effects', 'lightning', kind='frames', names=['lighteningBall'])
    add('heal-effect', 'heal')
    add('angel-shield-effect', 'shield')
    add('5x-special-effects-2d', 'buff', 4, kind='frames')
    add('animated-particle-effects-1', 'buff', 1)
    add('free-pixel-effects-pack', 'debuff', names=['nebula', 'vortex', 'midnight'])
    add('fx-charge', 'charge')
    add('particle-pack-80-sprites', 'particle', names=['dirt', 'smoke', 'star', 'spark'])
    add('smoke-particle-assets', 'smoke')
    return result


def frames_for(root, pack, effect):
    path = root / pack['slug'] / effect['file']
    if effect['kind'] == 'sheet':
        with Image.open(path) as source:
            w, h = effect['frame']
            frames = [source.crop(((i % effect['cols']) * w, (i // effect['cols']) * h,
                                   (i % effect['cols'] + 1) * w, (i // effect['cols'] + 1) * h)).convert('RGBA')
                      for i in range(effect['cols'] * effect['rows'])]
    else:
        prefix = re.sub(r'\d+$', '', path.stem)
        paths = sorted((p for p in path.parent.glob('*.png') if p.stem.startswith(prefix)),
                       key=lambda p: int(re.search(r'\d+$', p.stem)[0]))
        frames = []
        for p in paths:
            with Image.open(p) as im:
                frames.append(im.convert('RGBA'))
    if pack['slug'] in ('particle-pack-80-sprites', 'smoke-particle-assets'):
        # These are alternative shapes, not animation frames.
        frames = frames[:1]
    clean = []
    for frame in frames:
        alpha = frame.getchannel('A')
        # Opaque black backgrounds are additive art; preserve existing transparent art.
        if alpha.getextrema() == (255, 255):
            rgb = frame.convert('RGB')
            alpha = ImageChops.lighter(ImageChops.lighter(*rgb.split()[:2]), rgb.split()[2])
            frame.putalpha(alpha)
        if frame.getchannel('A').getbbox():
            clean.append(frame)
    if not clean:
        raise ValueError(f'Empty effect: {path}')
    if pack['slug'] in ('particle-pack-80-sprites', 'smoke-particle-assets'):
        source = clean[0]
        animated = []
        for i in range(12):
            frame = Image.new('RGBA', source.size)
            scaled = ImageOps.scale(source, .55 + .45 * i / 11, Image.Resampling.LANCZOS)
            scaled.putalpha(scaled.getchannel('A').point(lambda a: round(a * (1 - i / 12))))
            frame.paste(scaled, ((source.width - scaled.width) // 2, (source.height - scaled.height) // 2))
            animated.append(frame)
        return animated
    return clean


def make_sheet(frames, count):
    indices = [round(i * (len(frames) - 1) / max(1, count - 1)) for i in range(count)]
    canvas_size = (max(f.width for f in frames), max(f.height for f in frames))
    sheet = Image.new('RGBA', (128 * count, 128))
    for column, index in enumerate(indices):
        canvas = Image.new('RGBA', canvas_size)
        frame = frames[index]
        canvas.paste(frame, ((canvas.width - frame.width) // 2, (canvas.height - frame.height) // 2))
        canvas = ImageOps.contain(canvas, (128, 128), Image.Resampling.LANCZOS)
        sheet.paste(canvas, (column * 128 + (128 - canvas.width) // 2, (128 - canvas.height) // 2))
    return sheet


def build(source):
    packs = json.loads((source / 'manifest.json').read_text(encoding='utf-8-sig'))
    dest = ROOT / 'public/pet/battle/fx'
    rows, used, counts = [], set(), {}
    with tempfile.TemporaryDirectory(prefix='pet-fx-') as temporary:
        for pack, effect, category in selected(packs):
            counts[category] = counts.get(category, 0) + 1
            ident = f'{category}-{counts[category]:02}'
            frames = frames_for(source, pack, effect)
            count = min(16, len(frames))
            png = Path(temporary) / f'{ident}.png'
            while True:
                make_sheet(frames, count).save(png)
                with contextlib.redirect_stdout(io.StringIO()):
                    convert(png, dest, 128 * count, 80)
                if (dest / f'{ident}.webp').stat().st_size <= 60_000:
                    break
                if count <= 2:
                    raise ValueError(f'{ident} exceeds 60KB')
                count -= 1
            with Image.open(dest / f'{ident}.webp') as check:
                assert check.size == (128 * count, 128) and 'A' in check.getbands()
            rows.append(dict(id=ident, path=f'/pet/battle/fx/{ident}.webp', frames=count,
                             size=128, duration=600 if category in ('impact', 'slash') else 800,
                             blend='screen' if pack['slug'] == 'particle-pack-80-sprites' else 'normal',
                             category=category, pack=pack['slug']))
            used.add(pack['source_page'])
    total = sum((dest / f"{r['id']}.webp").stat().st_size for r in rows)
    assert len(rows) >= 80 and total <= 4_000_000, (len(rows), total)
    output = '// Generated by scripts/build_fx_sheets.py.\n'
    output += 'export type FxSheet = { id: string; path: string; frames: number; size: number; duration: number; blend: "normal" | "screen"; category: string; pack: string };\n'
    output += 'export const PET_FX_SHEETS: readonly FxSheet[] = ' + json.dumps(rows, ensure_ascii=False, indent=2) + ';\n'
    (ROOT / 'lib/domine/pet-fx-sheets.ts').write_text(output, encoding='utf-8')
    credits = ROOT / 'docs/pet-credits.md'
    lines = credits.read_text(encoding='utf-8').splitlines()
    credits.write_text('\n'.join(line.replace('| 아직 |', '| 사용 |') if any(url + ' |' in line for url in used) else line for line in lines) + '\n', encoding='utf-8')
    print(f'{len(rows)} sheets, {total:,} bytes, {len(used)} packs; {counts}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=ROOT.parent / 'domine-ref/free')
    build(parser.parse_args().source)

"""List/extract members of an FM24 .fm save. usage:
  python3 -I tools/fm_members.py SAVE list
  python3 -I tools/fm_members.py SAVE extract OUTDIR name1 name2 ...   (decompresses to OUTDIR/name)"""
import sys, struct, mmap, os
from compression.zstd import ZstdDecompressor
def open_save(path):
    f = open(path, "rb"); m = mmap.mmap(f.fileno(), 0, access=mmap.ACCESS_READ)
    ptr = struct.unpack_from("<Q", m, 9)[0]
    man = ZstdDecompressor().decompress(m[9 + ptr + 9:])
    p = 0
    def u32():
        nonlocal p; v = struct.unpack_from("<I", man, p)[0]; p += 4; return v
    def u64():
        nonlocal p; v = struct.unpack_from("<Q", man, p)[0]; p += 8; return v
    def s():
        nonlocal p; l = u32(); v = man[p:p + l].decode("utf8", "replace"); p += l; return v
    s(); cnt = u32()
    def member():
        nonlocal p
        parts = [s()]
        while not parts[-1].startswith("."): parts.append(s())
        off = u64(); st = u64(); pl = u64(); p += 16
        return ("".join(parts[:-1]) + parts[-1], off, st, pl)
    mem = {}
    for _ in range(cnt):
        n, o, st, pl = member(); mem[n] = (o, st, pl)
    for _ in range(u32()):
        sub = s()
        for _ in range(u32()):
            n, o, st, pl = member(); mem[sub + "/" + n] = (o, st, pl)
    return m, mem
def read(m, mem, name):
    o, st, pl = mem[name]
    return ZstdDecompressor().decompress(m[26 + o:26 + o + st]) if st else b""
if __name__ == "__main__":
    m, mem = open_save(sys.argv[1])
    if sys.argv[2] == "list":
        for n, (o, st, pl) in sorted(mem.items(), key=lambda x: -x[1][2])[:int(os.environ.get("N", 60))]: print(f"{n:50s} {st:>12,} {pl:>14,}")
        print(len(mem), "members")
    else:
        os.makedirs(sys.argv[3], exist_ok=True)
        for n in sys.argv[4:]:
            b = read(m, mem, n); open(os.path.join(sys.argv[3], n.replace("/", "_")), "wb").write(b); print(n, len(b))

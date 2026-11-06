"""Person-record relation table (FM24 24.3.0+0): per player a list of (referenced id, kind, role, qualifier).
Layout (verified against SaveLens' nationality reading; entry fields as in fm-toolkit's FM26 notes):
  end = person_offset + 19 + u32@(person_offset+15)  ; flag u8@end+33 == 1 ; count u8@end+34 ; entries of 16 bytes from end+35
  entry: u32 referenced id @0 ; kind u8 @10 ; role u8 @11 ; qualifier u8 @12 ; sentinel @15"""
import struct
def relations(db, person_offset, identity_offset=None):
    n = struct.unpack_from("<I", db, person_offset + 15)[0]
    end = person_offset + 19 + n
    if db[end + 33] != 1: return None
    count = db[end + 34]
    if identity_offset is not None and end + 35 + count * 16 > identity_offset: return None
    out = []
    for k in range(count):
        p = end + 35 + k * 16
        out.append((struct.unpack_from("<I", db, p)[0], db[p + 10], db[p + 11], db[p + 12], db[p + 15]))
    return out

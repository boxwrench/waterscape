"""Conservative offline editor for copied modern Java worlds; always validate in game."""
import io, math, pathlib, sys, zlib
import numpy as np
sys.path.insert(0,str(pathlib.Path(__file__).parent.parent/'Livermore-Arnis'/'python-packages'))
import nbtlib
from nbtlib import Compound, String, List, LongArray, Byte

def read_region(path):
    data=path.read_bytes(); assert len(data)>=8192
    loc=data[:4096]; timestamps=data[4096:8192]; chunks={}
    for i in range(1024):
        entry=int.from_bytes(loc[i*4:i*4+4],'big'); sector=entry>>8; count=entry&255
        if not entry: continue
        # Newer versions (26.3) do not pad the file's last sector, so check the chunk's own bytes.
        assert sector>=2 and count and sector*4096+5<=len(data)
        pos=sector*4096; length=int.from_bytes(data[pos:pos+4],'big')
        assert 1<=length<=count*4096-4 and pos+4+length<=len(data) and not(data[pos+4]&128), 'unsupported external chunk'
        chunks[i]=data[pos:pos+4+length]
    return chunks,timestamps

def decode_chunk(raw):
    typ=raw[4]; assert typ==2, f'Unsupported compression {typ}'
    return nbtlib.File.parse(io.BytesIO(zlib.decompress(raw[5:])))

def encode_chunk(chunk):
    b=io.BytesIO(); chunk.write(b); payload=zlib.compress(b.getvalue(),6)
    return (len(payload)+1).to_bytes(4,'big')+b'\x02'+payload

def write_region(path,chunks,timestamps):
    locations=bytearray(4096); out=bytearray(8192); out[4096:8192]=timestamps
    for i,raw in sorted(chunks.items()):
        sector=len(out)//4096; count=(len(raw)+4095)//4096
        assert count<=255 and sector<2**24
        locations[i*4:i*4+4]=((sector<<8)|count).to_bytes(4,'big')
        out.extend(raw); out.extend(b'\0'*(count*4096-len(raw)))
    out[:4096]=locations
    temp=path.with_suffix('.mca.tmp'); temp.write_bytes(out); temp.replace(path)

def unpack(section):
    state=section['block_states']; palette=state['palette']; bits=max(4,(len(palette)-1).bit_length())
    if len(palette)==1: return np.zeros(4096,dtype=np.uint16)
    words=np.array([int(x)&((1<<64)-1) for x in state['data']],dtype=np.uint64)
    per=64//bits; idx=np.arange(4096); return ((words[idx//per] >> ((idx%per)*bits).astype(np.uint64)) & np.uint64((1<<bits)-1)).astype(np.uint16)

def pack(section,arr):
    state=section['block_states']; bits=max(4,(len(state['palette'])-1).bit_length()); per=64//bits
    words=[0]*math.ceil(4096/per)
    for i,v in enumerate(arr): words[i//per] |= int(v)<<((i%per)*bits)
    state['data']=LongArray([w if w < 1<<63 else w-(1<<64) for w in words])

def palette_id(section,name,properties=None):
    state=section['block_states']; pal=state['palette']
    for i,p in enumerate(pal):
        if str(p['Name'])==name and dict(p.get('Properties',{}))==dict(properties or {}): return i
    block=Compound({'Name':String(name)})
    if properties: block['Properties']=Compound({k:String(v) for k,v in properties.items()})
    pal.append(block); return len(pal)-1

def height_set(chunk,kind,x,z,y):
    vals=chunk['Heightmaps'][kind]; i=(z%16)*16+x%16; word=i//7; shift=(i%7)*9
    n=int(vals[word])&((1<<64)-1); n=(n&~(511<<shift)) | ((y+65)<<shift)
    vals[word]=n if n < 1<<63 else n-(1<<64)

def mark_relight(chunk):
    chunk['isLightOn']=Byte(0)
    for s in chunk['sections']:
        s.pop('BlockLight',None); s.pop('SkyLight',None)

import gzip,json,pathlib,sys
root=pathlib.Path(__file__).parent;sys.path.insert(0,str(root.parent/'Livermore-Arnis'/'python-packages'))
import numpy as np
from PIL import Image
from pyproj import Transformer
m=json.loads((root/'source/terrain.json').read_text());w,h=m['width'],m['height'];raw=np.frombuffer(gzip.decompress((root/'source/terrain.bin.gz').read_bytes()),'<u2').reshape(4,h,w)
ch=[]
for key,a in zip(('height','shoreDistance','valley','drawdown'),raw):
 d=(np.cumsum(a.astype(np.uint64),axis=0)%65536).astype(np.float32);ch.append(d*m['channels'][key]['scale']+m['channels'][key]['offset'])
np.savez_compressed(root/'source/decoded.npz',height=ch[0],shore=ch[1])
cell=m['cell'][0];x0,z0=m['gridOrigin'];xs=np.arange(w)*cell+x0;zs=np.arange(h)*cell+z0
sel=(xs>=-5500)&(xs<=-2500);rows=(zs>=-1500)&(zs<=1500);height=ch[0][np.ix_(rows,sel)];shore=ch[1][np.ix_(rows,sel)]
print('Crop size:',height.shape,'land elevation relative to water percentiles:',np.percentile(height[shore>=0],[0,25,50,75,95,100]).round(1).tolist(),'water cells:',int((shore<0).sum()))
color=np.zeros((*height.shape,3),dtype=np.uint8);heightshade=np.clip((height+50)/900,0,1);color[:,:,0]=(105+120*heightshade).astype('uint8');color[:,:,1]=(125+100*heightshade).astype('uint8');color[:,:,2]=(84+120*heightshade).astype('uint8');color[shore<0]=[56,103,160];Image.fromarray(color).resize((900,900)).save(root/'source/height-preview.png')
t=Transformer.from_crs(32611,4326,always_xy=True);oe,on=m['originUTM'];corners=[t.transform(oe+x,on-z) for x in (-5500,-2500) for z in (-1500,1500)];print('WGS bbox:',min(x for x,y in corners),min(y for x,y in corners),max(x for x,y in corners),max(y for x,y in corners))

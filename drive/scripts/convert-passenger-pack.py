#!/usr/bin/env python3
"""Extract the user-supplied Comrade1280 CC-BY-4.0 glTF pack into lazy-load GLBs.
Usage: python convert-passenger-pack.py extracted-directory output-directory
Requires numpy and Pillow. Does not download assets. Original geometry is retained.
"""
import copy, hashlib, io, json, pathlib, struct, sys
import numpy as np
from PIL import Image

source=pathlib.Path(sys.argv[1]); dest=pathlib.Path(sys.argv[2]);dest.mkdir(parents=True,exist_ok=True)
gltf=json.loads((source/'scene.gltf').read_text()); binary=(source/'scene.bin').read_bytes()
MODELS={'comet':(15,[19,21,23,25],5.2,'Coupe'),'rally':(27,[31,33,35,37],4.85,'Hatchback'),'pickup':(65,[63,69,71,73],5.7,'Pickup'),'hypercar':(95,[87,89,91,93],5.0,'Sport')}
DT={5120:'i1',5121:'u1',5122:'<i2',5123:'<u2',5125:'<u4',5126:'<f4'}; SIZE={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
def accessor(i):
 a=gltf['accessors'][i]; v=gltf['bufferViews'][a['bufferView']];d=np.dtype(DT[a['componentType']]);n=SIZE[a['type']]
 return np.ndarray((a['count'],n),dtype=d,buffer=binary,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',d.itemsize*n),d.itemsize)).copy()
world={}
def walk(i,parent=np.eye(4)):
 n=gltf['nodes'][i]
 if any(k in n for k in ['rotation','translation','scale']):raise ValueError('Unexpected non-matrix source node')
 m=parent@np.array(n.get('matrix',np.eye(4).T.flatten())).reshape(4,4).T;world[i]=m
 for c in n.get('children',[]):walk(c,m)
for root in gltf['scenes'][gltf.get('scene',0)]['nodes']:walk(root)
def meshes(i):
 n=gltf['nodes'][i]
 if 'mesh' in n:yield i,n['mesh']
 for c in n.get('children',[]):yield from meshes(c)
summary={}
for key,(body_id,wheel_ids,target_length,label) in MODELS.items():
 # Coupe's body has baked-in rotation, unlike the other cars. Wheel basis is authoritative.
 basis=world[wheel_ids[0]][:3,:3].copy();basis/=np.linalg.norm(basis,axis=0)
 canonical=np.array([[1,0,0],[0,0,1],[0,-1,0]])@basis.T
 transform=np.eye(4);transform[:3,:3]=canonical
 parts=[]
 for kind,root_id in [('body',body_id)]+[('wheel',i) for i in wheel_ids]:
  for node_id,mesh_id in meshes(root_id):
   matrix=transform@world[node_id]
   for primitive in gltf['meshes'][mesh_id]['primitives']:
    attrs={k:accessor(v) for k,v in primitive['attributes'].items()}
    attrs['POSITION']=(np.c_[attrs['POSITION'],np.ones(len(attrs['POSITION']))]@matrix.T)[:,:3]
    if 'NORMAL' in attrs:
     attrs['NORMAL']=attrs['NORMAL']@np.linalg.inv(matrix[:3,:3]);attrs['NORMAL']/=np.linalg.norm(attrs['NORMAL'],axis=1)[:,None]
    parts.append({'kind':kind,'root':root_id,'name':gltf['nodes'][node_id]['name'],'attrs':attrs,'indices':accessor(primitive['indices']).flatten(),'material':primitive['material']})
 allpoints=np.concatenate([p['attrs']['POSITION'] for p in parts]);scale=target_length/np.ptp(allpoints[:,2])
 wheel_centers={}
 for wid in wheel_ids:
  pts=np.concatenate([p['attrs']['POSITION'] for p in parts if p['root']==wid]);wheel_centers[wid]=(pts.min(0)+pts.max(0))/2
 center=np.mean(list(wheel_centers.values()),axis=0);center[1]=allpoints[:,1].min()
 for p in parts:p['attrs']['POSITION']=(p['attrs']['POSITION']-center)*scale
 for wid in wheel_ids:wheel_centers[wid]=(wheel_centers[wid]-center)*scale
 out={'asset':{'version':'2.0','generator':'convert-passenger-pack.py','copyright':'Generic passenger car pack by Comrade1280, CC BY 4.0; normalized and textures resized for Car Go Vroom'},'scene':0,'scenes':[{'nodes':[0]}],'nodes':[{'name':key,'children':[1]},{'name':'body','children':[]}],'meshes':[],'accessors':[],'bufferViews':[],'buffers':[],'materials':[],'textures':[],'images':[],'samplers':[]}
 blob=bytearray(); material_map={};texture_map={};sampler_map={}
 def view(data,target=None):
  while len(blob)%4:blob.append(0)
  i=len(out['bufferViews']);v={'buffer':0,'byteOffset':len(blob),'byteLength':len(data)}
  if target:v['target']=target
  out['bufferViews'].append(v);blob.extend(data);return i
 def output_accessor(array,component,typ):
  a=np.asarray(array,dtype=DT[component]);i=len(out['accessors']);v=view(a.tobytes(),34963 if typ=='SCALAR' else 34962)
  record={'bufferView':v,'componentType':component,'count':len(a),'type':typ}
  if typ=='VEC3':record.update(min=a.min(0).tolist(),max=a.max(0).tolist())
  out['accessors'].append(record);return i
 def texture(ti):
  if ti in texture_map:return texture_map[ti]
  t=gltf['textures'][ti];iminfo=gltf['images'][t['source']];im=Image.open(source/iminfo['uri']);im.thumbnail((1024,1024),Image.Resampling.LANCZOS)
  stream=io.BytesIO()
  # Base colors are JPEG; exact packed roughness/metal channels remain lossless PNG.
  if 'metallicRoughness' in iminfo['uri']:
   im.save(stream,format='PNG',optimize=True);mime='image/png'
  else:
   im.convert('RGB').save(stream,format='JPEG',quality=88,optimize=True,subsampling=0);mime='image/jpeg'
  image_index=len(out['images']);out['images'].append({'name':pathlib.Path(iminfo['uri']).name,'bufferView':view(stream.getvalue()),'mimeType':mime})
  new={'source':image_index}
  if 'sampler' in t:
   si=t['sampler']
   if si not in sampler_map:sampler_map[si]=len(out['samplers']);out['samplers'].append(copy.deepcopy(gltf['samplers'][si]))
   new['sampler']=sampler_map[si]
  texture_map[ti]=len(out['textures']);out['textures'].append(new);return texture_map[ti]
 def material(mi):
  if mi in material_map:return material_map[mi]
  m=copy.deepcopy(gltf['materials'][mi])
  def remap(o):
   if isinstance(o,dict):
    for k,v in o.items():
     if k.endswith('Texture') and isinstance(v,dict) and 'index' in v:v['index']=texture(v['index'])
     else:remap(v)
   elif isinstance(o,list):
    for v in o:remap(v)
  remap(m);material_map[mi]=len(out['materials']);out['materials'].append(m);return material_map[mi]
 wheel_nodes={};wheel_stats=[]
 for wid in wheel_ids:
  c=wheel_centers[wid];name='wheel-'+('front' if c[2]>0 else 'back')+'-'+('left' if c[0]>0 else 'right')
  i=len(out['nodes']);out['nodes'].append({'name':name,'translation':c.tolist(),'children':[]});out['nodes'][0]['children'].append(i);wheel_nodes[wid]=i
  points=np.concatenate([p['attrs']['POSITION'] for p in parts if p['root']==wid]);size=np.ptp(points,axis=0)
  wheel_stats.append({'name':name,'position':c.tolist(),'radius':float((size[1]+size[2])/4),'width':float(size[0])})
 tris=0; brake_triangles=0
 for p in parts:
  attrs=p['attrs'];parent=1
  if p['kind']=='wheel':attrs['POSITION']-=wheel_centers[p['root']];parent=wheel_nodes[p['root']]
  a={k:output_accessor(v,5126,'VEC'+str(v.shape[1])) for k,v in attrs.items()}
  tri_indices=p['indices'].reshape(-1,3); tris+=len(tri_indices)
  groups=[(tri_indices,material(p['material']))]
  # Reuse actual authored rear red lens faces, never floating lamp boxes.
  source_mat=gltf['materials'][p['material']]
  if 'Optics' in source_mat['name']:
   ti=source_mat['pbrMetallicRoughness']['baseColorTexture']['index']
   image=np.asarray(Image.open(source/gltf['images'][gltf['textures'][ti]['source']]['uri']).convert('RGB'))
   uv=attrs['TEXCOORD_0'][tri_indices].mean(1); pixels=image[(uv[:,1]*(len(image)-1)).astype(int)%len(image),(uv[:,0]*(image.shape[1]-1)).astype(int)%image.shape[1]].astype(float)
   centers=attrs['POSITION'][tri_indices].mean(1)
   red=(pixels[:,0]>60)&(pixels[:,0]>pixels[:,1]*1.8)&(pixels[:,0]>pixels[:,2]*1.8)&(centers[:,2]<-target_length*.25)
   if red.any():
    brake=copy.deepcopy(out['materials'][material(p['material'])]);brake['name']='BrakeLens';brake['emissiveFactor']=[.15,.15,.15];brake['emissiveTexture']=copy.deepcopy(brake['pbrMetallicRoughness']['baseColorTexture'])
    bi=len(out['materials']);out['materials'].append(brake);groups=[(tri_indices[~red],material(p['material'])),(tri_indices[red],bi)];brake_triangles+=int(red.sum())
  primitives=[]
  for group,mi in groups:
   if not len(group):continue
   indices=output_accessor(group.flatten(),5123 if group.max()<65536 else 5125,'SCALAR');primitives.append({'attributes':a,'indices':indices,'material':mi,'mode':4})
  mi=len(out['meshes']);out['meshes'].append({'name':p['name'],'primitives':primitives})
  ni=len(out['nodes']);out['nodes'].append({'name':p['name'],'mesh':mi});out['nodes'][parent]['children'].append(ni)
 while len(blob)%4:blob.append(0)
 out['buffers']=[{'byteLength':len(blob)}];raw=json.dumps(out,separators=(',',':')).encode()
 raw+=b' '*((-len(raw))%4)
 glb=struct.pack('<III',0x46546c67,2,12+8+len(raw)+8+len(blob))+struct.pack('<II',len(raw),0x4e4f534a)+raw+struct.pack('<II',len(blob),0x004e4942)+blob
 path=dest/(key+'.glb');path.write_bytes(glb)
 normalized=(allpoints-center)*scale
 summary[key]={'sourceModel':label,'file':path.name,'triangles':tris,'brakeLensTriangles':brake_triangles,'bytes':len(glb),'sha256':hashlib.sha256(glb).hexdigest(),'width':float(np.ptp(normalized[:,0])),'length':float(np.ptp(normalized[:,2])),'height':float(np.ptp(normalized[:,1])),'wheels':sorted(wheel_stats,key=lambda w:w['name'])}
(dest/'manifest.json').write_text(json.dumps(summary,indent=2)+'\n');(dest/'LICENSE.txt').write_bytes((source/'license.txt').read_bytes())
print(json.dumps(summary,indent=2))

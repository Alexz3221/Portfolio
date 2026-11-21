(function(root, factory) {
  const concrete = factory();
  if (typeof module === 'object' && module.exports) module.exports = concrete;
  else root.DrivePortfolioExchangeConcrete = concrete;
})(globalThis, function() {
  'use strict';

  const file = typeof document !== 'undefined' && document.currentScript?.src
    ? new URL('../assets/portfolio-type/board-concrete.webp',document.currentScript.src).href
    : 'assets/portfolio-type/board-concrete.webp';

  function create(THREE, grime) {
    const ready = {value:0};
    const map = typeof document === 'undefined' ? null : new THREE.TextureLoader().load(file,()=>{
      ready.value=1;
    },undefined,()=>{ /* The shader keeps the concrete base color if the image is unavailable. */ });
    if (map) {
      map.name = 'exchange-board-concrete';
      map.wrapS = map.wrapT = THREE.RepeatWrapping;
      map.encoding = THREE.sRGBEncoding;
      map.anisotropy = 4;
    }
    const material=new THREE.MeshStandardMaterial({
      name:'Exchange weathered concrete',
      color:map ? 0xb7ada0 : 0x332c23,
      map,bumpMap:grime || null,bumpScale:.065,
      vertexColors:true,roughness:.94,metalness:.02
    });
    material.customProgramCacheKey=()=> 'exchange-weathered-board-concrete';
    material.onBeforeCompile=shader=>{
      shader.uniforms.exchangeMapReady=ready;
      const input='varying vec2 exchangeMeters;\n';
      shader.vertexShader=input+shader.vertexShader.replace('#include <uv_vertex>',`#include <uv_vertex>
        exchangeMeters = uv;`);
      const weather=`
        uniform float exchangeMapReady;
        float exchangeHash(vec2 tile) {
          tile = fract(tile * vec2(.1031,.11369));
          tile += dot(tile,tile.yx + 19.19);
          return fract((tile.x + tile.y) * tile.x);
        }
        float exchangeWeather(vec2 p) {
          vec2 i = floor(p), t = fract(p);
          t = t*t*(3.-2.*t);
          return mix(mix(exchangeHash(i),exchangeHash(i+vec2(1,0)),t.x),
                     mix(exchangeHash(i+vec2(0,1)),exchangeHash(i+vec2(1,1)),t.x),t.y);
        }`;
      const color=THREE.ShaderChunk.map_fragment
        .replace('vUv','(exchangeMeters * vec2(.333,.405))')
        .replace('diffuseColor *= texelColor;',`
          diffuseColor.rgb *= mix(vec3(.259,.239,.212),texelColor.rgb,exchangeMapReady);`);
      const bump=THREE.ShaderChunk.bumpmap_pars_fragment.replace(/\bvUv\b/g,'(exchangeMeters * vec2(.92,.81))');
      shader.fragmentShader=(input+weather+'\n'+shader.fragmentShader)
        .replace('#include <map_fragment>',color)
        .replace('#include <bumpmap_pars_fragment>',bump)
        .replace('#include <color_fragment>',`#include <color_fragment>
          // Water runs mostly downward. A slower second field varies entire panels
          // so stains remain independent of the repeating board-form texture.
          float climate = exchangeWeather(exchangeMeters * vec2(.32,.19) + vec2(7.9,1.4));
          float runoff = exchangeWeather(vec2(exchangeMeters.x * 1.34 + climate*.56,exchangeMeters.y * .092));
          float streak = smoothstep(.41,.81,runoff) * (.52+.48*climate);
          float dust = smoothstep(.39,.76,climate);
          diffuseColor.rgb *= mix(vec3(1.07,1.04,1.),vec3(.73,.695,.62),streak);
          diffuseColor.rgb *= .89 + .20*dust;`);
    };
    return material;
  }

  return {create};
});

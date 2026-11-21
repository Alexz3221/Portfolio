(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./vendor/polygon-clipping-0.15.7.min.js'));
  } else if (root.polygonClipping) {
    root.DrivePortfolioStreets = factory(root.polygonClipping);
  }
})(globalThis, function (polygons) {
  'use strict';

  function streetFootprint(roads, areas, margin) {
    const junctions = new Map();
    const shapes = [];
    for (const {x1,z1,x2,z2,width} of roads) {
      const dx = x2-x1, dz = z2-z1;
      const length = Math.hypot(dx,dz);
      if (length < .01) continue;
      const radius = width/2 + margin;
      const ox = -dz/length*radius, oz = dx/length*radius;
      shapes.push([[
        [x1+ox,z1+oz], [x2+ox,z2+oz], [x2-ox,z2-oz], [x1-ox,z1-oz]
      ]]);
      for (const [x,z] of [[x1,z1],[x2,z2]]) {
        const key = x + ',' + z;
        const previous = junctions.get(key);
        if (!previous || previous.radius < radius) junctions.set(key,{x,z,radius});
      }
    }

    // The rounded caps fill the outside of bends and blend into connecting
    // streets. Unioning the caps and strips removes shared triangle faces.
    for (const {x,z,radius} of junctions.values()) {
      const ring = [];
      for (let step=0; step<32; step++) {
        const angle = step*Math.PI/16;
        ring.push([x+Math.cos(angle)*radius,z+Math.sin(angle)*radius]);
      }
      shapes.push([ring]);
    }
    for (const {x,z,w,d} of areas) {
      const a = w/2+margin, b = d/2+margin;
      shapes.push([[[x-a,z-b],[x+a,z-b],[x+a,z+b],[x-a,z+b]]]);
    }
    return shapes.length ? polygons.union(...shapes) : [];
  }

  function surface(THREE, world, area, y, material, name, metersPerTile) {
    if (!area.length) return;
    const points = ring => ring.slice(0,-1).map(([x,z]) => new THREE.Vector2(x,-z));
    const shapes = area.map(([outline,...holes]) => {
      const shape = new THREE.Shape(points(outline));
      shape.holes = holes.map(hole => new THREE.Path(points(hole)));
      return shape;
    });
    const geometry = new THREE.ShapeGeometry(shapes);
    geometry.rotateX(-Math.PI/2);
    geometry.translate(0,y,0);
    const uv = geometry.getAttribute('uv');
    const location = geometry.getAttribute('position');
    const scaleX = metersPerTile*(material.map?.repeat.x || 1);
    const scaleY = metersPerTile*(material.map?.repeat.y || 1);
    for (let index=0; index<uv.count; index++) uv.setXY(index,location.getX(index)/scaleX,location.getZ(index)/scaleY);
    const mesh = new THREE.Mesh(geometry,material);
    mesh.name = name;
    mesh.receiveShadow = true;
    world.add(mesh);
  }

  function build(THREE, world, {roads, areas, asphalt, curb}) {
    const pavement = streetFootprint(roads,areas,0);
    if (!pavement.length) return;
    const sidewalk = polygons.difference(streetFootprint(roads,areas,1.15),pavement);
    surface(THREE,world,pavement,.044,asphalt,'portfolio-streets',4);
    surface(THREE,world,sidewalk,.066,curb,'portfolio-curbs',2.8);
  }

  return {build};
});

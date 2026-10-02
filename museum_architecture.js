
/*
 * Museu Virtual Prazeres Interrompidos
 * Arquitetura procedural — substitui o template 3D por uma arquitectura
 * construída directamente em Babylon.js, mantendo o sistema de navegação
 * OpenVGal (nomes d_<sala>_<indice>).
 *
 * Este ficheiro é um "adaptador": é carregado depois de room_builder_aux.js
 * e envolve populate_template(). Assim, não é necessário alterar o viewer
 * OpenVGal nem o sistema de navegação.
 */
(function () {
  "use strict";

  var MUSEUM_ROOT = "__PI_MUSEUM_ROOT__";

  function mat(scene, name, color, opts) {
    opts = opts || {};
    var m = scene.getMaterialByName(name);
    if (m) return m;
    m = new BABYLON.StandardMaterial(name, scene);
    m.diffuseColor = BABYLON.Color3.FromHexString(color);
    m.specularColor = new BABYLON.Color3(opts.specular || 0.08, opts.specular || 0.08, opts.specular || 0.08);
    m.roughness = opts.roughness == null ? 0.7 : opts.roughness;
    if (opts.emissive) m.emissiveColor = BABYLON.Color3.FromHexString(opts.emissive);
    return m;
  }

  function box(scene, root, name, size, pos, material, collision) {
    var b = BABYLON.MeshBuilder.CreateBox(name, {width:size[0], height:size[1], depth:size[2]}, scene);
    b.position.set(pos[0], pos[1], pos[2]);
    b.material = material;
    b.parent = root;
    b.checkCollisions = collision !== false;
    b.isPickable = false;
    b.metadata = Object.assign({}, b.metadata, { museumGenerated:true });
    return b;
  }

  function cylinder(scene, root, name, diameter, height, pos, material) {
    var c = BABYLON.MeshBuilder.CreateCylinder(name, {diameter:diameter, height:height, tessellation:48}, scene);
    c.position.set(pos[0], pos[1], pos[2]);
    c.material = material;
    c.parent = root;
    c.checkCollisions = true;
    c.isPickable = false;
    c.metadata = {museumGenerated:true};
    return c;
  }

  function text(scene, root, name, value, pos, size, color) {
    if (!BABYLON.MeshBuilder.CreateText || typeof fontContent === "undefined") return null;
    try {
      var t = BABYLON.MeshBuilder.CreateText(name, value, fontContent, {
        size:size || 0.28, resolution:8, depth:0.035,
        sideOrientation:BABYLON.Mesh.DOUBLESIDE
      }, scene);
      t.position.set(pos[0],pos[1],pos[2]);
      t.material = mat(scene, "__pi_text", color || "#efe8dc", {emissive:color || "#efe8dc"});
      t.parent = root;
      t.isPickable = false;
      t.metadata = {museumGenerated:true};
      return t;
    } catch(e) {
      console.warn("Museu: CreateText indisponível", e);
      return null;
    }
  }

  function hideTemplate(scene) {
    scene.meshes.slice().forEach(function(mesh) {
      if (mesh.metadata && mesh.metadata.museumGenerated) return;
      mesh.setEnabled(false);
      mesh.checkCollisions = false;
      mesh.isPickable = false;
    });
  }

  function clearPrevious(scene) {
    var old = scene.getTransformNodeByName(MUSEUM_ROOT);
    if (old) old.dispose(false, true);
  }

  function addCrown(scene, root, x, z, material) {
    var a = box(scene, root, "crown_a", [0.16,0.8,0.16], [x,4.55,z], material, false);
    var b = box(scene, root, "crown_b", [0.9,0.12,0.16], [x,4.92,z], material, false);
    a.rotation.z = 0;
    return [a,b];
  }

  function makeDoor(scene, root, destination, index, x, z, front, label, palette) {
    var frameMat = mat(scene, "__pi_door_frame", "#9d7b55", {roughness:0.42});
    var doorMat = mat(scene, "__pi_door", palette || "#33251d", {roughness:0.38});
    var gold = mat(scene, "__pi_gold", "#b89562", {roughness:0.3, specular:0.25});

    // A real clickable architectural door. It is deliberately non-colliding:
    // OpenVGal handles the click -> gallery transition.
    var door = BABYLON.MeshBuilder.CreateBox("d_" + destination + "_" + index, {
      width:1.55, height:2.65, depth:0.12
    }, scene);
    door.position.set(x,1.48,z);
    door.material=doorMat;
    door.parent=root;
    door.checkCollisions=false;
    door.isPickable=true;
    door.metadata={museumGenerated:true, museumDoor:true, destination:destination};

    // frame
    box(scene, root, "door_frame_l_"+index, [0.18,2.95,0.22], [x-0.88,1.5,z], frameMat, false);
    box(scene, root, "door_frame_r_"+index, [0.18,2.95,0.22], [x+0.88,1.5,z], frameMat, false);
    box(scene, root, "door_frame_t_"+index, [1.94,0.18,0.22], [x,2.92,z], frameMat, false);
    box(scene, root, "door_inlay_"+index, [0.95,0.045,0.045], [x,1.48,z-(front?0.08:-0.08)], gold, false);

    var labelZ=z-(front?0.09:-0.09);
    text(scene, root, "door_text_"+index, label || destination.replace(/#/g," "), [x,3.22,labelZ], 0.19, "#f1e7d5");
    return door;
  }

  function addRoomShell(scene, root, roomName) {
    var floor = mat(scene,"__pi_floor","#5a4535",{roughness:0.82});
    var wall = mat(scene,"__pi_wall","#e9e0d2",{roughness:0.8});
    var trim = mat(scene,"__pi_trim","#a88c68",{roughness:0.5});
    var ceiling = mat(scene,"__pi_ceiling","#f4efe7",{roughness:0.9});

    var W=18, D=25, H=6;
    box(scene,root,"floor",[W,0.18,D],[0,-0.12,0],floor,true);
    box(scene,root,"ceiling",[W,0.18,D],[0,H,0],ceiling,false);

    // Side walls.
    box(scene,root,"wall_left",[0.35,H,D],[-W/2, H/2, 0],wall,true);
    box(scene,root,"wall_right",[0.35,H,D],[W/2, H/2, 0],wall,true);

    // Back wall is split into sections to create a broad architectural portal.
    box(scene,root,"back_left",[W/2-2.2,H,D*0.035],[-W/4-1.1,H/2,D/2],wall,true);
    box(scene,root,"back_right",[W/2-2.2,H,D*0.035],[W/4+1.1,H/2,D/2],wall,true);
    box(scene,root,"back_top",[4.4,H-2.7,D*0.035],[0,H-1.35,D/2],wall,true);

    // cornices
    box(scene,root,"cornice_l",[0.45,0.24,D],[-W/2+0.25,H-0.18,0],trim,false);
    box(scene,root,"cornice_r",[0.45,0.24,D],[W/2-0.25,H-0.18,0],trim,false);

    // central ceiling spine
    box(scene,root,"ceiling_spine",[0.16,0.10,D-2],[0,H-0.05,0],trim,false);

    // Room title.
    var title = roomName === "root" ? "ÁTRIO DOS LIVROS" : roomName.replace(/#/g," ");
    text(scene,root,"room_title",title,[0,4.55,D/2-0.08],0.38,"#4a3528");

    return {W:W,D:D,H:H,floor:floor,wall:wall,trim:trim,ceiling:ceiling};
  }

  function buildRoot(scene, root, config) {
    var shell=addRoomShell(scene,root,"root");
    var gold=mat(scene,"__pi_gold_root","#b89562",{roughness:0.28,specular:0.28});
    var stone=mat(scene,"__pi_stone","#d9d0c2",{roughness:0.82});
    var dark=mat(scene,"__pi_dark","#2b211b",{roughness:0.55});

    // Grand central circular compass / atrium.
    cylinder(scene,root,"atrium_base",6.6,0.25,[0,0.08,0],stone);
    cylinder(scene,root,"atrium_ring_1",5.0,0.18,[0,0.25,0],gold);
    cylinder(scene,root,"atrium_ring_2",3.7,0.12,[0,0.36,0],stone);

    // Central "book spiral" sculpture, deliberately light and procedural.
    for(var i=0;i<8;i++){
      var ang=i*Math.PI/4;
      var r=1.25 + i*0.18;
      var p=box(scene,root,"spiral_"+i,[1.8,0.18,0.55],[Math.cos(ang)*r,0.85+i*0.33,Math.sin(ang)*r],gold,false);
      p.rotation.y=ang+Math.PI/2;
    }

    // Main entrance portal at the back of the root hall.
    box(scene,root,"entrance_header",[7.4,0.65,0.55],[0,4.75,shell.D/2-0.22],dark,false);
    text(scene,root,"museum_name","MUSEU VIRTUAL\nPRAZERES INTERROMPIDOS",[0,4.82,shell.D/2-0.56],0.34,"#f2e9dc");

    // Front façade suggestion: monumental doorway with columns.
    var z=-shell.D/2+0.35;
    box(scene,root,"facade_pediment",[10.5,0.8,0.55],[0,5.15,z],stone,false);
    box(scene,root,"facade_step1",[9.0,0.25,2.0],[0,0.12,z-0.65],stone,true);
    box(scene,root,"facade_step2",[7.8,0.20,1.3],[0,0.34,z-0.32],stone,true);
    for(var c=-3;c<=3;c+=2){
      cylinder(scene,root,"column_"+c,0.42,4.2,[c,2.2,z],stone);
    }
    text(scene,root,"facade_motto","LIVROS · IDEIAS · PESSOAS · MUNDOS",[0,4.55,z-0.42],0.22,"#4a3528");

    // Root doors from config.
    var gallery=config["root"]||{};
    var doors=Object.keys(gallery).filter(function(k){return gallery[k]&&gallery[k].resource_type==="door";});
    if(!doors.length){
      doors=Object.keys(config).filter(function(k){return k!=="Technical"&&k!=="root";}).map(function(k){return k;});
    }
    var radius=7.5;
    doors.forEach(function(d,i){
      var a=(-Math.PI/2)+(i/Math.max(1,doors.length))*Math.PI*2;
      var x=Math.cos(a)*radius, z2=Math.sin(a)*radius;
      var label=d.replace(/#/g," ");
      makeDoor(scene,root,d,i,x,z2,false,label, i%2?"#3b2a23":"#2e2822");
    });
  }

  function buildGallery(scene, root, config, roomName) {
    var shell=addRoomShell(scene,root,roomName);
    var gallery=config[roomName]||{};
    var doors=Object.keys(gallery).filter(function(k){return gallery[k]&&gallery[k].resource_type==="door";});

    // Main return door is always present, so the visitor never gets trapped.
    var backDest="root";
    makeDoor(scene,root,backDest,0,0,-shell.D/2+0.12,true,"ÁTRIO DOS LIVROS","#3a2a22");

    // Additional gallery doors form a small architectural sequence.
    var extra=doors.filter(function(d){return d!==backDest;});
    extra.slice(0,4).forEach(function(d,i){
      var x=-5.2+i*3.45;
      makeDoor(scene,root,d,i+1,x,shell.D/2-0.12,false,d.replace(/#/g," "),"#312722");
    });

    // Seating / plinths.
    var bench=mat(scene,"__pi_bench","#4b3a2d",{roughness:0.8});
    for(var i=0;i<3;i++) box(scene,root,"bench_"+i,[3.0,0.32,0.65],[0,0.18,-2+i*3.0],bench,true);

    // Gallery wall accent bands.
    var accent=mat(scene,"__pi_accent","#8e6f53",{roughness:0.62});
    box(scene,root,"accent_back",[10,0.16,0.12],[0,0.72,shell.D/2-0.2],accent,false);
    box(scene,root,"accent_left",[0.12,0.16,14],[-shell.W/2+0.2,0.72,0],accent,false);
    box(scene,root,"accent_right",[0.12,0.16,14],[shell.W/2-0.2,0.72,0],accent,false);
  }

  function buildMuseumArchitecture(config, roomName, scene) {
    if (!scene || !window.BABYLON) return;

    hideTemplate(scene);
    clearPrevious(scene);

    var root=new BABYLON.TransformNode(MUSEUM_ROOT,scene);
    root.metadata={museumGenerated:true};

    if(roomName==="root") buildRoot(scene,root,config);
    else buildGallery(scene,root,config,roomName);

    // Neutral environment lighting; OpenVGal's lighting module can still add its own.
    var hemi=scene.getLightByName("__pi_hemi");
    if(!hemi){
      hemi=new BABYLON.HemisphericLight("__pi_hemi",new BABYLON.Vector3(0,1,0),scene);
      hemi.intensity=0.75;
      hemi.diffuse=new BABYLON.Color3(1,0.95,0.88);
      hemi.specular=new BABYLON.Color3(0.25,0.22,0.18);
    }

    // Small point lights for a warm museum feel.
    for(var i=0;i<7;i++){
      var light=scene.getLightByName("__pi_point_"+i);
      if(!light){
        light=new BABYLON.PointLight("__pi_point_"+i,new BABYLON.Vector3(
          (i%3-1)*5,4.7, -8+i*2.5
        ),scene);
        light.diffuse=new BABYLON.Color3(1,0.82,0.62);
        light.intensity=18;
        light.range=14;
      }
    }

    // Tell the existing loader that the architecture is ready.
    if(typeof setLightsProgress==="function") setLightsProgress(100);
    if(typeof beginTemplateLoad==="function") {
      // The legacy name is retained for compatibility; no GLB is used by this layer.
    }
  }

  // Public hook.
  window.buildMuseumArchitecture=buildMuseumArchitecture;

  // Wrap the existing room builder without replacing the OpenVGal viewer.
  function installWrapper(){
    if(typeof window.populate_template !== "function"){
      setTimeout(installWrapper,50);
      return;
    }
    if(window.populate_template.__museumWrapped) return;
    var original=window.populate_template;
    var wrapped=function(config_file,room_name,scene){
      try { buildMuseumArchitecture(config_file,room_name,scene); }
      catch(e){ console.error("Museu: erro na arquitectura",e); }
      return original.apply(this,arguments);
    };
    wrapped.__museumWrapped=true;
    window.populate_template=wrapped;
    console.log("Museu: arquitectura procedural instalada.");
  }

  installWrapper();
})();

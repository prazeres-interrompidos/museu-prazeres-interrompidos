/* Museu Virtual Prazeres Interrompidos
 * Architectural shell for the main museum hall.
 * Keeps the existing OpenVGal artwork/gallery engine and replaces only the
 * root-room presentation with a purpose-built museum building.
 */
(function () {
  'use strict';

  var ROOT_NAME = 'root';
  var ARCH_ROOT = 'PI_MUSEUM_ARCHITECTURE';
  var builtScene = null;

  var rooms = [
    ['Galeria I', 'Episódios 1–100'],
    ['Galeria II', 'Episódios 101–200'],
    ['Galeria III', 'Episódios 201–300'],
    ['Galeria IV', 'Episódios 301–400'],
    ['Galeria V', 'Episódios 401–500'],
    ['Galeria VI', 'Episódios 501–600'],
    ['Galeria Internacional', 'Literatura sem fronteiras'],
    ['Galeria dos Autores', 'Autores e escritores'],
    ['Galeria Temática', 'Percursos por temas'],
    ['Livros Imaginários', 'Livros que poderiam existir'],
    ['Sala de Escuta', 'Os episódios ganham vida'],
    ['Exposições Temporárias', 'Exposições especiais']
  ];

  var palette = {
    floor: '#171513',
    floor2: '#2b2119',
    wall: '#3b3937',
    wallLight: '#57524d',
    stone: '#c9c0b3',
    stoneLight: '#e7dfd2',
    brass: '#b8925d',
    gold: '#d2b07a',
    glass: '#93aebd',
    darkGlass: '#1b2930',
    banner: '#3d2027',
    white: '#f4efe7',
    ink: '#161311',
    green: '#263a2d'
  };

  function hex(h) {
    h = h.replace('#','');
    return new BABYLON.Color3(parseInt(h.substr(0,2),16)/255, parseInt(h.substr(2,2),16)/255, parseInt(h.substr(4,2),16)/255);
  }

  function mat(scene, name, color, opts) {
    opts = opts || {};
    var m = new BABYLON.StandardMaterial(name, scene);
    m.diffuseColor = hex(color);
    m.specularColor = new BABYLON.Color3(opts.specular || 0.12, opts.specular || 0.12, opts.specular || 0.12);
    if (opts.emissive) m.emissiveColor = hex(opts.emissive);
    if (opts.alpha != null) { m.alpha = opts.alpha; m.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND; }
    return m;
  }

  function box(scene, name, x,y,z, sx,sy,sz, material, parent) {
    var m = BABYLON.MeshBuilder.CreateBox(name, {width:sx,height:sy,depth:sz}, scene);
    m.position.set(x,y,z); m.material = material; if(parent) m.parent=parent;
    return m;
  }

  function cyl(scene, name, x,y,z, diameter,height, material, parent, tess) {
    var m = BABYLON.MeshBuilder.CreateCylinder(name, {diameter:diameter,height:height,tessellation:tess||32}, scene);
    m.position.set(x,y,z); m.material=material; if(parent) m.parent=parent;
    return m;
  }

  function text(scene, name, value, x,y,z, size, color, parent, rotY) {
    if (!window.fontContent || !BABYLON.MeshBuilder.CreateText) return null;
    var m = BABYLON.MeshBuilder.CreateText(name, value, window.fontContent, {size:size||0.45,resolution:8,depth:0.04,sideOrientation:BABYLON.Mesh.DOUBLESIDE}, scene);
    m.position.set(x,y,z); m.material = mat(scene,name+'_mat',color||palette.white); if(parent)m.parent=parent;
    if(rotY) m.rotation.y=rotY;
    return m;
  }

  function panel(scene, name, value, x,y,z,w,h, material, parent, rotY) {
    var p = BABYLON.MeshBuilder.CreatePlane(name,{width:w,height:h,sideOrientation:BABYLON.Mesh.DOUBLESIDE},scene);
    p.position.set(x,y,z); p.material=material; if(parent)p.parent=parent; if(rotY)p.rotation.y=rotY;
    var tex = new BABYLON.DynamicTexture(name+'_tex',{width:1024,height:512},scene,false);
    var ctx=tex.getContext(); ctx.clearRect(0,0,1024,512); ctx.fillStyle='#00000000'; ctx.fillRect(0,0,1024,512);
    ctx.fillStyle='#f4efe7'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.font='bold 54px Georgia';
    var parts=String(value).split('\n');
    parts.forEach(function(t,i){ctx.fillText(t,512,220+i*68);});
    tex.update();
    var pm=mat(scene,name+'_panel', '#171513'); pm.diffuseTexture=tex; pm.emissiveTexture=tex; pm.disableLighting=true; pm.useAlphaFromDiffuseTexture=true;
    p.material=pm; return p;
  }

  function arch(scene, parent, x,z, w,h, depth, label, target) {
    var stone=mat(scene,'stone_'+x+'_'+z,palette.stone);
    var dark=mat(scene,'door_'+x+'_'+z,palette.darkGlass,{specular:0.3});
    var brass=mat(scene,'brass_'+x+'_'+z,palette.brass,{specular:0.55});
    var baseY=0;
    box(scene,'portal_left_'+x+'_'+z,x-w/2+0.32,h/2,z,0.64,h,stone,parent);
    box(scene,'portal_right_'+x+'_'+z,x+w/2-0.32,h/2,z,0.64,h,stone,parent);
    box(scene,'portal_top_'+x+'_'+z,x,h-0.32,z,w,0.64,depth,stone,parent);
    box(scene,'door_'+x+'_'+z,x,h*0.40,z-0.01,w*0.52,h*0.80,0.10,dark,parent);
    box(scene,'door_header_'+x+'_'+z,x,h*0.82,z-0.08,w*0.55,0.08,0.12,brass,parent);
    var click=box(scene,'d_'+target+'_1',x,h*0.40,z-0.12,w*0.58,h*0.82,0.16,mat(scene,'click_'+x+'_'+z,'#000000',{alpha:0}),parent);
    click.isPickable=true;
    click.metadata={museumDoor:true,target:target};
    click.actionManager=new BABYLON.ActionManager(scene);
    click.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger,function(){
      if(typeof window.galleryManager==='function') window.galleryManager({source:{name:'d_'+target+'_1'}});
    }));
    text(scene,'label_'+target.replace(/\s/g,'_'),label.replace(/#/g,' '),x,h+0.55,z-0.08,0.30,palette.ink,parent,0);
    return click;
  }

  function hideOldRootTemplate(scene) {
    // The imported template is useful for the individual galleries, but the root
    // room is now entirely procedural. Keep cameras/lights and hide only meshes
    // that came from the old room before the new architecture is built.
    scene.meshes.slice().forEach(function(m){
      if (!m || m.metadata && m.metadata.museumArchitecture) return;
      if (m.name && (m.name.indexOf('T_')===0 || m.name.indexOf('d_')===0)) return;
      // Artwork/frames are not expected in root; hide imported template geometry.
      m.setEnabled(false);
    });
  }

  function setRootCamera(scene) {
    var camera = scene.activeCamera;
    if (!camera) return;
    camera.position = new BABYLON.Vector3(0,7.2,34);
    if (camera.setTarget) camera.setTarget(new BABYLON.Vector3(0,5.0,0));
    else camera.target = new BABYLON.Vector3(0,5.0,0);
    camera.minZ=0.1; camera.maxZ=500;
  }

  function buildMuseum(scene) {
    if (!scene || builtScene===scene) return;
    builtScene=scene;

    hideOldRootTemplate(scene);
    var root=new BABYLON.TransformNode(ARCH_ROOT,scene);

    var floor=mat(scene,'museum_floor',palette.floor);
    var floorWood=mat(scene,'museum_wood',palette.floor2);
    var stone=mat(scene,'museum_stone',palette.stone);
    var stoneLight=mat(scene,'museum_stone_light',palette.stoneLight);
    var wall=mat(scene,'museum_wall',palette.wall);
    var brass=mat(scene,'museum_brass',palette.brass,{specular:0.65});
    var glass=mat(scene,'museum_glass',palette.glass,{specular:0.7,alpha:0.42});
    var dark=mat(scene,'museum_dark',palette.darkGlass,{specular:0.35});
    var green=mat(scene,'museum_green',palette.green);

    // Main floor and central atrium.
    box(scene,'museum_floor',0,-0.20,0,74,0.4,62,floor,root);
    box(scene,'museum_wood_floor',0,0.01,0,62,0.08,48,floorWood,root);
    cyl(scene,'atrium_floor',0,0.07,0,23,0.10,stoneLight,root,64);
    cyl(scene,'atrium_ring',0,0.14,0,19,0.08,brass,root,64);

    // Rear and side walls of the grand hall.
    box(scene,'rear_wall',0,7,-27,74,14,0.65,wall,root);
    box(scene,'left_wall',-36,7,0,0.65,14,54,wall,root);
    box(scene,'right_wall',36,7,0,0.65,14,54,wall,root);

    // Ceiling beams and skylight.
    for(var bx=-30; bx<=30; bx+=10) box(scene,'ceiling_beam_'+bx, bx,13.4,0,0.35,0.35,52,stone,root);
    box(scene,'skylight_frame',0,13.5,0,20,0.25,10,brass,root);
    box(scene,'skylight_glass',0,13.56,0,18,0.08,8,glass,root);

    // Grand entrance/facade at the front.
    box(scene,'facade_left',-18,7,28,2.4,14,1.0,stone,root);
    box(scene,'facade_right',18,7,28,2.4,14,1.0,stone,root);
    box(scene,'facade_top',0,13,28,38,2.0,1.0,stone,root);
    box(scene,'entrance_glass',0,6.0,27.35,15,10,0.18,glass,root);
    for(var cx=-16;cx<=16;cx+=4) cyl(scene,'front_col_'+cx,cx,7,27.0,0.65,13,stone,root,32);
    // dome and drum
    cyl(scene,'dome_drum',0,13.2,28,13,2.2,stone,root,48);
    var dome=BABYLON.MeshBuilder.CreateSphere('dome',{diameter:16,segments:48,arc:0.5},scene); dome.position.set(0,14.1,28); dome.material=stoneLight; dome.scaling.y=0.75; dome.parent=root;
    cyl(scene,'dome_finial',0,18.0,28,1.2,1.4,brass,root,32);
    // steps
    for(var st=0;st<5;st++) box(scene,'step_'+st,0,0.18+st*0.16,29.4+st*0.55,18-st*1.5,0.30,1.1,stoneLight,root);

    panel(scene,'museum_title','MUSEU VIRTUAL\nPRAZERES INTERROMPIDOS',0,9.6,27.18,12,3.2,dark,root);
    text(scene,'entrance_motto','Livros · Ideias · Pessoas · Mundos',0,12.0,26.95,0.34,palette.white,root,0);

    // Central book sculpture / spiral.
    for(var s=0;s<18;s++){
      var a=s*0.48, r=0.75+s*0.12;
      var bx=r*Math.cos(a), bz=r*Math.sin(a);
      box(scene,'book_'+s,bx,0.55+s*0.28,bz,2.6,0.18,0.75, s%2?stoneLight:brass,root);
    }
    cyl(scene,'sculpture_base',0,0.25,0,7,0.4,stoneLight,root,64);
    text(scene,'atrium_title','ÁTRIO DOS LIVROS',0,3.0,-3.9,0.46,palette.ink,root,0);

    // Garden/reading area along the rear wall.
    box(scene,'reading_garden',0,0.08,-24.8,22,0.12,3.0,green,root);
    for(var tx=-9;tx<=9;tx+=3){
      cyl(scene,'garden_tree_'+tx,tx,1.0,-24.7,1.2,2.0,green,root,24);
      cyl(scene,'garden_trunk_'+tx,tx,0.6,-24.7,0.28,1.1,brass,root,20);
    }
    text(scene,'garden_label','JARDIM DA LEITURA',0,2.3,-25.7,0.34,palette.white,root,0);

    // Gallery portals: six principal galleries on the two sides, with thematic rooms at rear.
    var leftX=-29, rightX=29;
    var y=0;
    var zPositions=[-18,-6,6,18];
    arch(scene,root,leftX,zPositions[0],6.4,7.0,0.6,'Galeria I','Galeria I');
    arch(scene,root,leftX,zPositions[1],6.4,7.0,0.6,'Galeria III','Galeria III');
    arch(scene,root,leftX,zPositions[2],6.4,7.0,0.6,'Galeria V','Galeria V');
    arch(scene,root,leftX,zPositions[3],6.4,7.0,0.6,'Autores','Galeria dos Autores');
    arch(scene,root,rightX,zPositions[0],6.4,7.0,0.6,'Galeria II','Galeria II');
    arch(scene,root,rightX,zPositions[1],6.4,7.0,0.6,'Galeria IV','Galeria IV');
    arch(scene,root,rightX,zPositions[2],6.4,7.0,0.6,'Galeria VI','Galeria VI');
    arch(scene,root,rightX,zPositions[3],6.4,7.0,0.6,'Temática','Galeria Temática');

    // Rear thematic portals.
    arch(scene,root,-12,-25.8,7.2,6.6,0.6,'Internacional','Galeria Internacional');
    arch(scene,root,-3.9,-25.8,7.2,6.6,0.6,'Livros Imaginários','Livros Imaginários');
    arch(scene,root,4.2,-25.8,7.2,6.6,0.6,'Sala de Escuta','Sala de Escuta');
    arch(scene,root,12.3,-25.8,7.2,6.6,0.6,'Temporárias','Exposições Temporárias');

    // Side gallery wings: low walls suggest the floor plan from the reference image.
    for(var wing=-1; wing<=1; wing+=2){
      var xx=wing*22;
      for(var zz=-22;zz<=22;zz+=11){
        box(scene,'wing_wall_'+wing+'_'+zz,xx,4.0,zz,0.35,8.0,8.5,wallLight(scene),root);
      }
    }

    // Small directional signs.
    panel(scene,'sign_left','GALERIAS\nI · III · V',-24,10,-1,5.0,2.0,dark,root,Math.PI/2);
    panel(scene,'sign_right','GALERIAS\nII · IV · VI',24,10,-1,5.0,2.0,dark,root,-Math.PI/2);

    // Museum lights. Use a restrained set of point/spot lights.
    var hemi=new BABYLON.HemisphericLight('museum_hemi',new BABYLON.Vector3(0,1,0),scene); hemi.intensity=0.55; hemi.diffuse=hex('#fff4e6'); hemi.groundColor=hex('#221b16');
    for(var lx=-24;lx<=24;lx+=12){
      var pl=new BABYLON.PointLight('museum_light_'+lx,new BABYLON.Vector3(lx,11,0),scene); pl.intensity=0.65; pl.range=30; pl.diffuse=hex('#ffe2b7');
    }

    root.getChildMeshes().forEach(function(m){m.metadata=Object.assign({},m.metadata||{},{museumArchitecture:true});});
    setRootCamera(scene);
    scene.metadata=Object.assign({},scene.metadata||{},{prazeresInterrompidosMuseum:true});
    console.log('Museu Virtual Prazeres Interrompidos: arquitectura construída.');
  }

  function wallLight(scene){ return mat(scene,'wing_wall_mat',palette.wallLight); }

  function install() {
    if (typeof window.populate_template !== 'function') { setTimeout(install,250); return; }
    if (window.__PI_architecture_installed) return;
    window.__PI_architecture_installed=true;
    var original=window.populate_template;
    window.populate_template_original=original;
    window.populate_template=function(config_file,room_name,scene){
      if (room_name===ROOT_NAME) {
        beginTemplateLoad();
        buildMuseum(scene);
        // Root has no artwork loading phase; mark it complete immediately.
        percentage_artwork=100;
        var a=document.getElementById('percentLoaded_artwork'), b=document.getElementById('loadingBar_artwork');
        if(a)a.textContent='100%'; if(b)b.style.width='100%';
        markArtworksDone();
        return;
      }
      return original(config_file,room_name,scene);
    };
  }

  install();
})();

/* Museu Virtual Prazeres Interrompidos — arquitectura própria
 * VERSÃO CORRIGIDA
 *
 * Mantém:
 *   - OpenVGal/Babylon como motor
 *   - room_builder_aux.js para as obras
 *   - galleryManager() para a navegação
 *
 * Substitui:
 *   - o template visual antigo da sala "root"
 *   - a arquitectura da entrada/átrio/galerias
 *
 * A sala root é construída 100% por código. O template antigo é escondido,
 * inclusive se algum mesh do template aparecer depois da construção.
 */
(function () {
  'use strict';

  var ROOT = 'root';
  var ARCH = 'PI_MUSEUM_ARCHITECTURE_V3';
  var installed = false;
  var builtForScene = null;

  var C = {
    floor: '#171411',
    wood: '#34271d',
    wall: '#393735',
    wall2: '#504b45',
    stone: '#c9c0b3',
    lightStone: '#eee6da',
    gold: '#b99461',
    glass: '#91a9b8',
    dark: '#182126',
    green: '#294131',
    white: '#f5f0e8',
    ink: '#191613',
    burgundy: '#4a2730'
  };

  function color(hex) {
    hex = String(hex).replace('#','');
    return new BABYLON.Color3(
      parseInt(hex.substr(0,2),16)/255,
      parseInt(hex.substr(2,2),16)/255,
      parseInt(hex.substr(4,2),16)/255
    );
  }

  function material(scene, name, hex, options) {
    options = options || {};
    var m = new BABYLON.StandardMaterial(name, scene);
    m.diffuseColor = color(hex);
    m.specularColor = new BABYLON.Color3(
      options.specular == null ? 0.18 : options.specular,
      options.specular == null ? 0.18 : options.specular,
      options.specular == null ? 0.18 : options.specular
    );
    if (options.emissive) m.emissiveColor = color(options.emissive);
    if (options.alpha != null) {
      m.alpha = options.alpha;
      m.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;
    }
    return m;
  }

  function box(scene, name, x,y,z, w,h,d, mat, parent) {
    var m = BABYLON.MeshBuilder.CreateBox(name, {
      width:w, height:h, depth:d
    }, scene);
    m.position.set(x,y,z);
    m.material = mat;
    if (parent) m.parent = parent;
    tag(m);
    return m;
  }

  function cyl(scene, name, x,y,z, diameter,height, mat, parent, tess) {
    var m = BABYLON.MeshBuilder.CreateCylinder(name, {
      diameter:diameter, height:height, tessellation:tess || 32
    }, scene);
    m.position.set(x,y,z);
    m.material = mat;
    if (parent) m.parent = parent;
    tag(m);
    return m;
  }

  function sphere(scene, name, x,y,z, diameter, mat, parent) {
    var m = BABYLON.MeshBuilder.CreateSphere(name, {
      diameter:diameter, segments:32
    }, scene);
    m.position.set(x,y,z);
    m.material = mat;
    if (parent) m.parent = parent;
    tag(m);
    return m;
  }

  function tag(mesh) {
    mesh.metadata = Object.assign({}, mesh.metadata || {}, {
      museumArchitecture: true
    });
  }

  function labelPlane(scene, name, lines, x,y,z, w,h, parent, rotationY, bg, fg) {
    var p = BABYLON.MeshBuilder.CreatePlane(name, {
      width:w, height:h, sideOrientation:BABYLON.Mesh.DOUBLESIDE
    }, scene);
    p.position.set(x,y,z);
    if (rotationY != null) p.rotation.y = rotationY;
    if (parent) p.parent = parent;
    tag(p);

    var tex = new BABYLON.DynamicTexture(name + '_texture', {
      width:1200, height:600
    }, scene, true);
    var ctx = tex.getContext();
    ctx.clearRect(0,0,1200,600);
    ctx.fillStyle = bg || '#182126';
    ctx.fillRect(0,0,1200,600);

    var arr = Array.isArray(lines) ? lines : String(lines).split('\n');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var lineHeight = arr.length > 3 ? 82 : 100;
    var start = 300 - ((arr.length-1) * lineHeight / 2);

    arr.forEach(function(line, i) {
      ctx.fillStyle = fg || '#f5f0e8';
      ctx.font = (i === 0 ? 'bold 54px Georgia' : '34px Georgia');
      ctx.fillText(String(line), 600, start + i*lineHeight);
    });
    tex.update();

    var pm = material(scene, name + '_material', '#ffffff');
    pm.diffuseTexture = tex;
    pm.emissiveTexture = tex;
    pm.disableLighting = true;
    p.material = pm;
    return p;
  }

  function hideForeignMeshes(scene) {
    scene.meshes.slice().forEach(function(m) {
      if (!m) return;
      if (m.metadata && m.metadata.museumArchitecture) return;
      m.setEnabled(false);
    });
  }

  function watchLateTemplateMeshes(scene) {
    if (scene.__PI_templateWatcher) return;
    scene.__PI_templateWatcher = true;

    if (scene.onNewMeshAddedObservable) {
      scene.onNewMeshAddedObservable.add(function(m) {
        if (!m) return;
        if (scene.metadata && scene.metadata.prazeresRootActive) {
          if (!(m.metadata && m.metadata.museumArchitecture)) {
            m.setEnabled(false);
          }
        }
      });
    }
  }

  function portal(scene, root, x,z, width,height, label, target, facing) {
    var stone = material(scene, 'portal_stone_' + target, C.stone);
    var dark = material(scene, 'portal_dark_' + target, C.dark, {specular:0.5});
    var gold = material(scene, 'portal_gold_' + target, C.gold, {specular:0.65});

    var frontZ = z + (facing === 'north' ? 0.08 : -0.08);
    var y = height/2;

    box(scene, 'portalL_' + target, x-width/2+0.28,y,z,0.56,height,0.72,stone,root);
    box(scene, 'portalR_' + target, x+width/2-0.28,y,z,0.56,height,0.72,stone,root);
    box(scene, 'portalT_' + target, x,height-0.28,z,width,0.56,0.72,stone,root);
    box(scene, 'portalDoor_' + target, x,height*0.42,frontZ,width*0.55,height*0.84,0.10,dark,root);
    box(scene, 'portalGold_' + target, x,height*0.82,frontZ-0.07,width*0.58,0.08,0.13,gold,root);

    var click = box(scene, 'd_' + target + '_1',
      x,height*0.42,frontZ-0.10,width*0.64,height*0.86,0.18,
      material(scene,'portal_click_' + target,'#000000',{alpha:0}),root);

    click.isPickable = true;
    click.metadata = Object.assign({}, click.metadata, {
      museumArchitecture:true,
      museumDoor:true,
      target:target
    });
    click.actionManager = new BABYLON.ActionManager(scene);
    click.actionManager.registerAction(
      new BABYLON.ExecuteCodeAction(
        BABYLON.ActionManager.OnPickTrigger,
        function() {
          if (typeof window.galleryManager === 'function') {
            window.galleryManager({source:{name:'d_' + target + '_1'}});
          }
        }
      )
    );

    labelPlane(scene, 'portalLabel_' + target, [label],
      x, height + 0.95, frontZ - 0.12,
      Math.max(4.5,width*0.95), 1.2, root,
      facing === 'north' ? 0 : Math.PI,
      '#4a2730', '#f5f0e8');
  }

  function buildEntrance(scene, root, stone, lightStone, gold, glass) {
    // Grande fachada frontal.
    box(scene,'facade_base',0,0.35,29.0,42,0.7,1.4,stone,root);
    box(scene,'facade_left',-19,7.2,29.0,2.4,13.2,1.2,stone,root);
    box(scene,'facade_right',19,7.2,29.0,2.4,13.2,1.2,stone,root);
    box(scene,'facade_top',0,13.0,29.0,40,2.0,1.2,stone,root);

    for (var x=-16; x<=16; x+=4) {
      cyl(scene,'facade_col_' + x,x,7.0,28.35,0.62,12.8,lightStone,root,32);
    }

    box(scene,'entrance_glass',0,6.2,28.30,15.0,10.5,0.14,glass,root);
    for (var gx=-6; gx<=6; gx+=3) {
      box(scene,'glass_mullion_' + gx,gx,6.2,28.18,0.10,10.2,0.10,gold,root);
    }

    // Porta monumental navegável para o átrio (não é uma galeria).
    box(scene,'mainDoorLeft',-3.2,3.8,28.05,5.8,7.6,0.16,material(scene,'mainDoorMat','#182126',{specular:0.45}),root);
    box(scene,'mainDoorRight',3.2,3.8,28.05,5.8,7.6,0.16,material(scene,'mainDoorMat2','#182126',{specular:0.45}),root);

    // Frontão e cúpula.
    cyl(scene,'domeDrum',0,13.8,29.0,14.0,2.2,stone,root,48);
    var dome = BABYLON.MeshBuilder.CreateSphere('dome',{
      diameter:17, segments:48, arc:0.5
    },scene);
    dome.position.set(0,15.0,29.0);
    dome.scaling.y=0.78;
    dome.material=lightStone;
    dome.parent=root;
    tag(dome);
    cyl(scene,'domeFinial',0,19.0,29.0,1.25,1.5,gold,root,32);

    // Escadaria.
    for (var s=0;s<6;s++) {
      box(scene,'entranceStep_' + s,0,0.20+s*0.16,30.0+s*0.62,
        19-s*1.7,0.32,1.15,lightStone,root);
    }

    labelPlane(scene,'museumTitle',
      ['MUSEU VIRTUAL','PRAZERES INTERROMPIDOS'],
      0,10.0,28.0,13.5,3.1,root,0,C.dark,C.white);

    labelPlane(scene,'museumMotto',
      ['Livros · Ideias · Pessoas · Mundos'],
      0,7.2,27.9,10.0,1.0,root,0,'#00000000',C.white);
  }

  function buildAtrium(scene, root, stone, lightStone, gold, green) {
    cyl(scene,'atriumFloor',0,0.08,0,25.0,0.12,lightStone,root,64);
    cyl(scene,'atriumRing1',0,0.16,0,21.0,0.10,gold,root,64);
    cyl(scene,'atriumRing2',0,0.22,0,18.0,0.08,stone,root,64);

    // Escultura central inspirada numa espiral de livros.
    for (var i=0;i<20;i++) {
      var a=i*0.46;
      var r=0.75+i*0.15;
      var px=Math.cos(a)*r;
      var pz=Math.sin(a)*r;
      box(scene,'bookSculpture_' + i,px,0.62+i*0.28,pz,
        2.9,0.18,0.78,i%2?gold:lightStone,root);
    }
    cyl(scene,'sculptureBase',0,0.30,0,7.5,0.42,lightStone,root,64);

    labelPlane(scene,'atriumTitle',['ÁTRIO DOS LIVROS'],
      0,3.0,-4.2,7.2,1.15,root,0,'#eee6da','#191613');

    // Jardim da leitura ao fundo.
    box(scene,'readingGarden',0,0.10,-24.7,23,0.16,3.4,green,root);
    for (var t=-9;t<=9;t+=3) {
      cyl(scene,'treeTrunk_' + t,t,0.65,-24.7,0.30,1.1,gold,root,20);
      sphere(scene,'treeCrown_' + t,t,1.35,-24.7,2.0,green,root);
    }
    labelPlane(scene,'gardenTitle',['JARDIM DA LEITURA'],
      0,2.55,-26.25,7.2,1.1,root,0,'#294131','#f5f0e8');
  }

  function buildSideWings(scene, root, wall, lightStone) {
    // Muros baixos que organizam visualmente os corredores sem bloquear a circulação.
    [-1,1].forEach(function(side) {
      var x=side*21.5;
      for (var z=-21; z<=21; z+=10.5) {
        box(scene,'wing_' + side + '_' + z,x,3.7,z,0.42,7.4,7.6,wall,root);
      }
    });

    // bancos no átrio.
    [-10,10].forEach(function(x){
      box(scene,'bench_' + x,x,0.48,-8.5,4.2,0.45,0.75,lightStone,root);
    });
  }

  function buildPortals(scene, root) {
    portal(scene,root,-29,-17,6.8,7.0,'Galeria I','Galeria I','south');
    portal(scene,root,-29,-5.5,6.8,7.0,'Galeria III','Galeria III','south');
    portal(scene,root,-29,6.0,6.8,7.0,'Galeria V','Galeria V','south');
    portal(scene,root,-29,17.5,6.8,7.0,'Autores','Galeria dos Autores','south');

    portal(scene,root,29,-17,6.8,7.0,'Galeria II','Galeria II','south');
    portal(scene,root,29,-5.5,6.8,7.0,'Galeria IV','Galeria IV','south');
    portal(scene,root,29,6.0,6.8,7.0,'Galeria VI','Galeria VI','south');
    portal(scene,root,29,17.5,6.8,7.0,'Temática','Galeria Temática','south');

    portal(scene,root,-12,-25.7,7.4,6.4,'Internacional','Galeria Internacional','north');
    portal(scene,root,-3.9,-25.7,7.4,6.4,'Livros Imaginários','Livros Imaginários','north');
    portal(scene,root,4.2,-25.7,7.4,6.4,'Sala de Escuta','Sala de Escuta','north');
    portal(scene,root,12.3,-25.7,7.4,6.4,'Temporárias','Exposições Temporárias','north');
  }

  function buildLighting(scene) {
    // Só adicionamos luzes próprias; não dependemos da iluminação do template.
    var hemi = new BABYLON.HemisphericLight(
      'PI_hemi', new BABYLON.Vector3(0,1,0), scene
    );
    hemi.intensity=0.72;
    hemi.diffuse=color('#fff4e7');
    hemi.groundColor=color('#211a15');

    for (var x=-24;x<=24;x+=12) {
      var p = new BABYLON.PointLight(
        'PI_point_' + x, new BABYLON.Vector3(x,11,0), scene
      );
      p.intensity=0.55;
      p.range=32;
      p.diffuse=color('#ffe1b8');
    }
  }

  function setCamera(scene) {
    var camera=scene.activeCamera;
    if (!camera) return;
    camera.position = new BABYLON.Vector3(0,5.2,42);
    if (camera.setTarget) camera.setTarget(new BABYLON.Vector3(0,5.4,10));
    camera.minZ=0.1;
    camera.maxZ=500;
  }

  function finishRootLoader() {
    var ids = [
      ['loadingBar_template','percentLoaded_template'],
      ['loadingBar_materials','percentLoaded_materials'],
      ['loadingBar_artwork','percentLoaded_artwork'],
      ['loadingBar_lights','percentLoaded_lights']
    ];
    ids.forEach(function(pair) {
      var bar=document.getElementById(pair[0]);
      var txt=document.getElementById(pair[1]);
      if (bar) bar.style.width='100%';
      if (txt) txt.textContent='100%';
    });

    var loader=document.getElementById('loader');
    if (loader) loader.style.display='none';
  }

  function buildMuseum(scene) {
    if (!scene || builtForScene===scene) return;
    builtForScene=scene;

    scene.metadata=Object.assign({},scene.metadata||{},{
      prazereresInterrompidosMuseum:true,
      prazeresRootActive:true
    });

    // Primeiro: esconder o que já veio do template.
    hideForeignMeshes(scene);
    watchLateTemplateMeshes(scene);

    var root=new BABYLON.TransformNode(ARCH,scene);
    root.metadata={museumArchitecture:true};

    var floor=material(scene,'PI_floor',C.floor);
    var wood=material(scene,'PI_wood',C.wood);
    var wall=material(scene,'PI_wall',C.wall);
    var stone=material(scene,'PI_stone',C.stone);
    var lightStone=material(scene,'PI_lightStone',C.lightStone);
    var gold=material(scene,'PI_gold',C.gold,{specular:0.65});
    var glass=material(scene,'PI_glass',C.glass,{specular:0.75,alpha:0.42});
    var green=material(scene,'PI_green',C.green);

    box(scene,'PI_floor',0,-0.20,0,76,0.40,64,floor,root);
    box(scene,'PI_woodFloor',0,0.01,0,64,0.08,50,wood,root);

    // Paredes estruturais.
    box(scene,'PI_rearWall',0,7,-28,76,14,0.70,wall,root);
    box(scene,'PI_leftWall',-37,7,0,0.70,56,wall,root);
    box(scene,'PI_rightWall',37,7,0,0.70,56,wall,root);

    // Cobertura leve com claraboia central.
    for (var bx=-30;bx<=30;bx+=10) {
      box(scene,'PI_ceilingBeam_' + bx,bx,13.7,0,0.35,0.35,52,stone,root);
    }
    box(scene,'PI_skylightFrame',0,13.55,0,21,0.22,10,gold,root);
    box(scene,'PI_skylight',0,13.60,0,19,0.08,8,glass,root);

    buildEntrance(scene,root,stone,lightStone,gold,glass);
    buildAtrium(scene,root,stone,lightStone,gold,green);
    buildSideWings(scene,root,wall,lightStone);
    buildPortals(scene,root);
    buildLighting(scene);
    setCamera(scene);

    // Garante que nenhum mesh do template reapareça por engano.
    hideForeignMeshes(scene);

    console.log('Museu Virtual Prazeres Interrompidos — arquitectura V3 construída.');
  }

  // Public entry point used by openvgal-viewer.js. The entrance is built
  // directly in Babylon and therefore must be callable before any GLB/template
  // is loaded for the entrance room.
  window.buildPrazeresMuseum = buildMuseum;
  window.finishPrazeresMuseumLoader = finishRootLoader;

  function install() {
    if (installed) return;
    if (typeof window.populate_template !== 'function') {
      setTimeout(install,100);
      return;
    }

    installed=true;
    var original=window.populate_template;
    window.populate_template_original=original;

    window.populate_template=function(config_file,room_name,scene) {
      if (room_name===ROOT) {
        // Não iniciamos o ciclo de loading do template antigo.
        // A root não usa GLB nem artwork: construímos tudo directamente.
        buildMuseum(scene);
        finishRootLoader();
        return;
      }

      // Todas as salas de exposição continuam a usar o sistema OpenVGal
      // original, incluindo capas, placas e navegação.
      return original(config_file,room_name,scene);
    };
  }

  install();
})();

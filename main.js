import './style.css';
import * as THREE from 'three';
import * as dat from 'dat.gui';
import gsap from 'gsap';
import Stats from 'three/addons/libs/stats.module.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';

// ─── EXISTING VARS (unchanged) ─────────────────────────────────────────────
let theme = 'light';
let bookCover = null;
let lightSwitch = null;
let titleText = null;
let subtitleText = null;
let mixer;
let isMobile = window.matchMedia('(max-width: 992px)').matches;
let canvas = document.querySelector('.experience-canvas');
const loaderWrapper = document.getElementById('loader-wrapper');
const loaderBar = document.getElementById('loader-bar');

let clipNames = [
  'fan_rotation','fan_rotation.001','fan_rotation.002',
  'fan_rotation.003','fan_rotation.004',
];
let projects = [
  { image: 'textures/spt.png',              url: 'https://sptsoulloops.netlify.app' },
  { image: 'textures/reachjtd.png',         url: 'https://reachjtd.com' },
  { image: 'textures/xcentod.jpg',          url: 'https://xcentod.netlify.app' },
  { image: 'textures/flora.png',            url: 'https://flavorsofflora.netlify.app' },
  { image: 'textures/chopexpress.jpg',      url: 'https://chopexpressgh.com' },
  { image: 'textures/turf.png',             url: 'https://turfcentral.netlify.app' },
  { image: 'textures/yitadengineering.png', url: 'https://yitadengineering.netlify.app' },
];
let aboutCameraPos   = { x: 0.12,  y: 0.2,   z: 0.55 };
let aboutCameraRot   = { x: -1.54, y: 0.13,  z: 1.41 };
let projectsCameraPos = { x: 1,    y: 0.45,  z: 0.01 };
let projectsCameraRot = { x: 0.05, y: 0.05,  z: 0 };

// ─── MAN CAVE STATE ────────────────────────────────────────────────────────
let particleSystem    = null;
let particleVelocities = [];
let f1FrameMeshes     = [];   // artwork planes — for raycasting
let neonAnimLights    = [];   // neon lights to flicker

// ─── SCENE & CAMERA ────────────────────────────────────────────────────────
const scene  = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.01, 1000);
let defaultCameraPos = { x: 1.009028643133046, y: 0.5463638814987481, z: 0.4983449671971262 };
let defaultCamerRot  = { x: -0.8313297556598935, y: 0.9383399492446749, z: 0.7240714481613063 };
camera.position.set(defaultCameraPos.x, defaultCameraPos.y, defaultCameraPos.z);

// ─── RENDERER ──────────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// ─── CONTROLS ──────────────────────────────────────────────────────────────
const controls = new OrbitControls(camera, renderer.domElement);
controls.enablePan = false;
controls.minDistance = 0.9;
controls.maxDistance = 1.6;
controls.minAzimuthAngle = 0.2;
controls.maxAzimuthAngle = Math.PI * 0.78;
controls.minPolarAngle = 0.3;
controls.maxPolarAngle = Math.PI / 2;
controls.update();

// ─── GLTF LOAD ─────────────────────────────────────────────────────────────
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('draco/');
const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

gltfLoader.load(
  'models/room.glb',
  function (room) {
    // ── video texture ──
    const video = document.createElement('video');
    video.src = 'textures/arcane2.mp4';
    video.muted = true; video.playsInline = true;
    video.autoplay = true; video.loop = true;
    const videoTexture = new THREE.VideoTexture(video);
    videoTexture.minFilter = THREE.NearestFilter;
    videoTexture.magFilter = THREE.NearestFilter;
    videoTexture.generateMipmaps = false;
    videoTexture.encoding = THREE.sRGBEncoding;

    room.scene.children.forEach((child) => {
      if (child.name !== 'Wall') child.castShadow = true;
      child.receiveShadow = true;
      if (child.children) {
        child.children.forEach((ic) => {
          if (ic.name !== 'Book001' && ic.name !== 'Switch') ic.castShadow = true;
          ic.receiveShadow = true;
        });
      }
      if (child.name === 'Stand') {
        child.children[0].material = new THREE.MeshBasicMaterial({ map: videoTexture });
        video.play();
      }
      if (child.name === 'CPU') {
        [0, 1].forEach(i => {
          child.children[i].material = new THREE.MeshPhysicalMaterial();
          child.children[i].material.roughness   = 0;
          child.children[i].material.color.set(0x999999);
          child.children[i].material.ior         = 3;
          child.children[i].material.transmission = i === 0 ? 2 : 1;
          child.children[i].material.opacity     = 0.8;
          child.children[i].material.depthWrite  = false;
          child.children[i].material.depthTest   = false;
        });
      }
      if (child.name === 'Book') {
        bookCover = child.children[0];
        const bookTex = new THREE.TextureLoader().load('textures/book-inner.jpg');
        bookTex.flipY = false;
        child.material = new THREE.MeshStandardMaterial({ color: 0xffffff, map: bookTex });
      }
      if (child.name === 'SwitchBoard') lightSwitch = child.children[0];
    });

    scene.add(room.scene);
    animate();

    mixer = new THREE.AnimationMixer(room.scene);
    clipNames.forEach(name => {
      const clip = THREE.AnimationClip.findByName(room.animations, name);
      if (clip) mixer.clipAction(clip).play();
    });

    // ── Man cave additions ──
    addManCaveFrames();
    createFloatingParticles();

    // ── Existing listeners ──
    loadIntroText();
    logoListener();
    aboutMenuListener();
    setupProjectsPlanes();
    projectsMenuListener();
    init3DWorldClickListeners();
    initResponsive(room.scene);
    initCommandPalette();

    // ── Smooth loader fade-out ──
    if (loaderBar) loaderBar.style.width = '100%';
    setTimeout(() => {
      if (loaderWrapper) loaderWrapper.classList.add('hidden');
      setTimeout(initIntroModal, 400);
    }, 500);
  },
  function (xhr) {
    if (xhr.total > 0 && loaderBar) {
      loaderBar.style.width = ((xhr.loaded / xhr.total) * 90) + '%';
    }
  },
  function (err) { console.error(err); }
);

// ─── LIGHTS (unchanged) ────────────────────────────────────────────────────
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const roomLight = new THREE.PointLight(0xffffff, 2.5, 10);
roomLight.position.set(0.3, 2, 0.5);
roomLight.castShadow = true;
roomLight.shadow.radius = 5;
roomLight.shadow.mapSize.width = 2048;
roomLight.shadow.mapSize.height = 2048;
roomLight.shadow.camera.far = 2.5;
roomLight.shadow.bias = -0.002;
scene.add(roomLight);

const fanLight1 = new THREE.PointLight(0xff0000, 30, 0.2);
const fanLight2 = new THREE.PointLight(0x00ff00, 30, 0.12);
const fanLight3 = new THREE.PointLight(0x00ff00, 30, 0.2);
const fanLight4 = new THREE.PointLight(0x00ff00, 30, 0.2);
const fanLight5 = new THREE.PointLight(0x00ff00, 30, 0.05);
fanLight1.position.set(0, 0.29, -0.29);
fanLight2.position.set(-0.15, 0.29, -0.29);
fanLight3.position.set(0.21, 0.29, -0.29);
fanLight4.position.set(0.21, 0.19, -0.29);
fanLight5.position.set(0.21, 0.08, -0.29);
scene.add(fanLight1, fanLight2, fanLight3, fanLight4, fanLight5);

const pointLight1 = new THREE.PointLight(0xff0000, 0, 1.1);
const pointLight2 = new THREE.PointLight(0xff0000, 0, 1.1);
const pointLight3 = new THREE.PointLight(0xff0000, 0, 1.1);
const pointLight4 = new THREE.PointLight(0xff0000, 0, 1.1);
pointLight1.position.set(-0.2, 0.6, 0.24);
pointLight2.position.set(-0.2, 0.6, 0.42);
pointLight3.position.set(-0.2, 0.6, 0.01);
pointLight4.position.set(-0.2, 0.6, -0.14);
scene.add(pointLight1, pointLight2, pointLight3, pointLight4);

// ─── ANIMATE ───────────────────────────────────────────────────────────────
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  if (mixer) mixer.update(clock.getDelta());
  updateParticles();
  animateNeon();
  renderer.render(scene, camera);
}

// ─── LOAD INTRO TEXT (unchanged) ───────────────────────────────────────────
function loadIntroText() {
  const loader = new FontLoader();
  loader.load('fonts/unione.json', function (font) {
    const mats = [
      new THREE.MeshPhongMaterial({ color: 0x171f27, flatShading: true }),
      new THREE.MeshPhongMaterial({ color: 0xffffff }),
    ];
    const geo = new TextGeometry(' Akinfolarin', { font, size: 0.08, height: 0.01 });
    titleText = new THREE.Mesh(geo, mats);
    titleText.rotation.y = Math.PI * 0.5;
    titleText.position.set(-0.27, 0.55, 0.5);
    scene.add(titleText);
  });
  loader.load('fonts/helvatica.json', function (font) {
    const mats = [
      new THREE.MeshPhongMaterial({ color: 0x171f27, flatShading: true }),
      new THREE.MeshPhongMaterial({ color: 0xffffff }),
    ];
    const geo = new TextGeometry(
      'Techpreneur / Software Developer / Gamer         Toggle switch for day/night',
      { font, size: 0.018, height: 0 }
    );
    subtitleText = new THREE.Mesh(geo, mats);
    subtitleText.rotation.y = Math.PI * 0.5;
    subtitleText.position.set(-0.255, 0.5, 0.5);
    scene.add(subtitleText);
  });
}

// ─── SWITCH THEME (unchanged) ──────────────────────────────────────────────
function switchTheme(themeType) {
  if (themeType === 'dark') {
    lightSwitch.rotation.z = Math.PI / 7;
    document.body.classList.replace('light-theme', 'dark-theme');
    gsap.to(roomLight.color, { r: 0.272, g: 0.231, b: 0.686 });
    gsap.to(ambientLight.color, { r: 0.172, g: 0.231, b: 0.686 });
    gsap.to(roomLight, { intensity: 1.5 });
    gsap.to(ambientLight, { intensity: 0.3 });
    gsap.to(fanLight5, { distance: 0.07 });
    gsap.to(titleText.material[0].color,  { r:8, g:8, b:8, duration:0 });
    gsap.to(titleText.material[1].color,  { r:5, g:5, b:5, duration:0 });
    gsap.to(subtitleText.material[0].color, { r:8, g:8, b:8, duration:0 });
    gsap.to(subtitleText.material[1].color, { r:5, g:5, b:5, duration:0 });
    gsap.to(pointLight1, { intensity: 0.6 });
    gsap.to(pointLight2, { intensity: 0.6 });
    gsap.to(pointLight3, { intensity: 0.6 });
    gsap.to(pointLight4, { intensity: 0.6 });
    // Boost neon in dark mode
    neonAnimLights.forEach(l => { l.baseIntensity = 1.4; });
  } else {
    lightSwitch.rotation.z = 0;
    document.body.classList.replace('dark-theme', 'light-theme');
    gsap.to(roomLight.color, { r:1, g:1, b:1 });
    gsap.to(ambientLight.color, { r:1, g:1, b:1 });
    gsap.to(roomLight, { intensity: 2.5 });
    gsap.to(ambientLight, { intensity: 0.6 });
    gsap.to(fanLight5, { distance: 0.05 });
    gsap.to(titleText.material[0].color, { r:0.09, g:0.121, b:0.152, duration:0 });
    gsap.to(titleText.material[1].color, { r:1, g:1, b:1, duration:0 });
    gsap.to(subtitleText.material[0].color, { r:0.09, g:0.121, b:0.152, duration:0 });
    gsap.to(subtitleText.material[1].color, { r:1, g:1, b:1, duration:0 });
    gsap.to(pointLight1, { intensity: 0 });
    gsap.to(pointLight2, { intensity: 0 });
    gsap.to(pointLight3, { intensity: 0 });
    gsap.to(pointLight4, { intensity: 0 });
    neonAnimLights.forEach(l => { l.baseIntensity = 0.8; });
  }
}

// ─── ORBIT HELPERS (unchanged) ─────────────────────────────────────────────
function enableOrbitControls()  { controls.enabled = true; }
function disableOrbitControls() { controls.enabled = false; }
function enableCloseBtn()  { document.getElementById('close-btn').style.display = 'block'; }
function disableCloseBtn() { document.getElementById('close-btn').style.display = 'none'; }

// ─── RESET HELPERS (unchanged) ─────────────────────────────────────────────
function resetBookCover() {
  if (!bookCover) return;
  gsap.to(bookCover.rotation, { x: 0, duration: 1.5 });
}

function resetProjects() {
  if (!projects.length) return;
  projects.forEach(p => {
    if (!p.mesh) return;
    gsap.to(p.mesh.material, { opacity: 0, duration: 1 });
    gsap.to(p.mesh.position, { y: p.y, duration: 1 });
    gsap.to(p.mesh.scale, { x: 0, y: 0, z: 0, duration: 0, delay: 1 });
  });
}

function resetCamera() {
  resetBookCover();
  resetProjects();
  disableCloseBtn();
  gsap.to(camera.position, { ...defaultCameraPos, duration: 1.5 });
  gsap.to(camera.rotation, { ...defaultCamerRot, duration: 1.5 });
  gsap.delayedCall(1.5, enableOrbitControls);
  if (theme !== 'dark') gsap.to(roomLight, { intensity: 2.5, duration: 1.5 });
}

// ─── LOGO ──────────────────────────────────────────────────────────────────
function logoListener() {
  document.getElementById('logo').addEventListener('click', e => {
    e.preventDefault(); resetCamera();
  });
}

// ─── ABOUT (unchanged) ─────────────────────────────────────────────────────
function cameraToAbout() {
  if (!bookCover) return;
  gsap.to(camera.position, { ...aboutCameraPos, duration: 1.5 });
  gsap.to(camera.rotation, { ...aboutCameraRot, duration: 1.5 });
  gsap.to(bookCover.rotation, { x: Math.PI, duration: 1.5, delay: 1.5 });
  if (theme !== 'dark') gsap.to(roomLight, { intensity: 1, duration: 1.5 });
}
function aboutMenuListener() {
  document.getElementById('about-menu').addEventListener('click', e => {
    e.preventDefault();
    disableOrbitControls();
    resetProjects();
    cameraToAbout();
    gsap.delayedCall(1.5, enableCloseBtn);
  });
}

// ─── PROJECTS — planes created once ────────────────────────────────────────
function setupProjectsPlanes() {
  const columns  = 3;
  const spacingX = 0.8;
  const startX   = 0.3;
  const startY   = 1;
  const spacingY = 0.5;
  const z        = -1.15;

  projects.forEach((project, i) => {
    const col = i % columns;
    const row = Math.floor(i / columns);
    const geo = new THREE.PlaneGeometry(0.71, 0.4);
    const mat = new THREE.MeshBasicMaterial({
      map: new THREE.TextureLoader().load(project.image),
      transparent: true,
      opacity: 0,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name     = 'project';
    mesh.userData = { url: project.url };
    mesh.position.set(startX + col * spacingX, startY - row * spacingY, z);
    mesh.scale.set(0, 0, 0);
    project.mesh = mesh;
    project.y    = mesh.position.y;
    scene.add(mesh);
  });
}

// openProjects — shared by menu click AND frame click
function openProjects() {
  disableOrbitControls();
  resetBookCover();
  gsap.to(camera.position, { ...projectsCameraPos, duration: 1.5 });
  gsap.to(camera.rotation, { ...projectsCameraRot, duration: 1.5 });
  gsap.delayedCall(1.5, enableCloseBtn);
  projects.forEach((p, i) => {
    p.mesh.scale.set(1, 1, 1);
    gsap.to(p.mesh.material, { opacity: 1, duration: 1.5, delay: 1.5 + i * 0.1 });
    gsap.to(p.mesh.position, { y: p.y + 0.05, duration: 1, delay: 1.5 + i * 0.1 });
  });
}

function projectsMenuListener() {
  document.getElementById('projects-menu').addEventListener('click', e => {
    e.preventDefault();
    openProjects();
  });
}

// ─── 3D WORLD CLICK LISTENERS (enhanced for f1frame) ───────────────────────
function init3DWorldClickListeners() {
  const mouse     = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();

  // ── hover: change cursor ──────────────────────────────────────
  const HOVERABLE = ['f1frame','Book','Book001','Switch','SwitchBoard','project'];
  window.addEventListener('mousemove', e => {
    mouse.x = (e.clientX / window.innerWidth)  *  2 - 1;
    mouse.y = (e.clientY / window.innerHeight) * -2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(scene.children, true);
    const hovering = hits.some(h => HOVERABLE.includes(h.object.name));
    renderer.domElement.style.cursor = hovering ? 'pointer' : 'default';
  });

  // ── click ─────────────────────────────────────────────────────
  window.addEventListener('click', e => {
    const newTheme = theme === 'light' ? 'dark' : 'light';

    const closeBtn   = document.getElementById('close-btn');
    const projBtn    = document.getElementById('projects-menu');
    if (closeBtn.contains(e.target) || projBtn.contains(e.target)) return;

    mouse.x = (e.clientX / window.innerWidth)  *  2 - 1;
    mouse.y = (e.clientY / window.innerHeight) * -2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(scene.children, true);

    hits.forEach(hit => {
      // ── F1 wall frame → open projects ──
      if (hit.object.name === 'f1frame') {
        openProjects();
        return;
      }
      // ── project card → open URL ──
      if (hit.object.name === 'project') {
        hit.object.userData.url && window.open(hit.object.userData.url);
        return;
      }
      // ── book → about ──
      if (hit.object.name === 'Book' || hit.object.name === 'Book001') {
        disableOrbitControls();
        cameraToAbout();
        gsap.delayedCall(1.5, enableCloseBtn);
        return;
      }
      // ── switch → toggle theme ──
      if (hit.object.name === 'SwitchBoard' || hit.object.name === 'Switch') {
        theme = newTheme;
        switchTheme(theme);
      }
    });
  });
}

// ─── RESPONSIVE (unchanged) ────────────────────────────────────────────────
function initResponsive(roomScene) {
  if (!isMobile) return;
  roomScene.scale.set(0.95, 0.95, 0.95);
  aboutCameraPos  = { x: 0.09,  y: 0.23, z: 0.51 };
  aboutCameraRot  = { x: -1.57, y: 0,    z: 1.57 };
  projectsCameraPos = { x: 1.1,  y: 0.82, z: 0.5 };
  projectsCameraRot = { x: 0,    y: 0,    z: 1.55 };
  projects.forEach(p => { if (p.mesh) p.mesh.position.z = -1.13; });
  controls.maxDistance = 1.5;
  controls.maxAzimuthAngle = Math.PI * 0.75;
}


// ═══════════════════════════════════════════════════════════════════════════
//  MAN CAVE — WALL ART FRAMES
//  Placed on the LEFT WALL (x ≈ -0.27), ABOVE the title/subtitle text.
//  Clicking any frame triggers the Projects view.
// ═══════════════════════════════════════════════════════════════════════════

// Frame layout on the left wall.
// y = 0.76 keeps them well above the title (y=0.55) and subtitle (y=0.50).
// z values spread the frames along the wall.
const FRAME_CONFIGS = [
  { id: 'hamilton', art: createHamiltonTexture, z: -0.08, w: 0.13, h: 0.16 },
  { id: 'ferrari',  art: createFerrariTexture,  z:  0.09, w: 0.13, h: 0.13 },
  { id: 'circuit',  art: createF1CircuitTexture, z: 0.25, w: 0.13, h: 0.13 },
  { id: 'speed',    art: createSpeedArtTexture,  z: 0.41, w: 0.13, h: 0.13 },
];

function addManCaveFrames() {
  FRAME_CONFIGS.forEach(cfg => {
    const texture = cfg.art();
    const group   = buildFrameMesh(texture, cfg.w, cfg.h, cfg.id);
    // Left wall: x=-0.27, facing +X (rotation.y = π/2)
    group.position.set(-0.27, 0.76, cfg.z);
    group.rotation.y = Math.PI / 2;
    scene.add(group);
  });

  addNeonLights();
}

// Builds a wall-mounted picture frame: outer border + inner artwork plane
function buildFrameMesh(texture, w, h, frameId) {
  const group = new THREE.Group();
  const thick = 0.012;   // frame border thickness
  const depth = 0.008;   // frame depth

  // Outer border — dark carbon
  const borderMat = new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 0.25,
    metalness: 0.75,
  });

  // Top / Bottom rails
  const railH = new THREE.Mesh(
    new THREE.BoxGeometry(w + thick * 2, thick, depth),
    borderMat
  );
  const railHB = railH.clone();
  railH.position.y  =  (h / 2) + thick / 2;
  railHB.position.y = -(h / 2) - thick / 2;
  group.add(railH, railHB);

  // Left / Right stiles
  const stile = new THREE.Mesh(
    new THREE.BoxGeometry(thick, h + thick * 2, depth),
    borderMat
  );
  const stileR = stile.clone();
  stile.position.x  = -(w / 2) - thick / 2;
  stileR.position.x =  (w / 2) + thick / 2;
  group.add(stile, stileR);

  // Inner gold accent line
  const accentMat = new THREE.MeshBasicMaterial({ color: 0xc8960c });
  const accentTop = new THREE.Mesh(new THREE.BoxGeometry(w + thick * 2, 0.002, depth + 0.001), accentMat);
  const accentBot = accentTop.clone();
  accentTop.position.y =  (h / 2) + thick;
  accentBot.position.y = -(h / 2) - thick;
  group.add(accentTop, accentBot);

  // Artwork plane — sits slightly in front of border
  const artMat = new THREE.MeshBasicMaterial({ map: texture, side: THREE.FrontSide });
  const artPlane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), artMat);
  artPlane.position.z = depth / 2 + 0.001;
  artPlane.name     = 'f1frame';
  artPlane.userData = { frameId };
  group.add(artPlane);

  // Store for raycasting
  f1FrameMeshes.push(artPlane);

  return group;
}

// ─── NEON LIGHT STRIPS ─────────────────────────────────────────────────────
// Two thin glowing strips on the left wall, above the frame row.
function addNeonLights() {
  // Ferrari red — spans above frames 1 & 2 (z ≈ -0.08 → 0.09)
  spawnNeonStrip({ x: -0.264, y: 0.868, z: 0.01 }, 0.23, 0xdc0000);
  // Hamilton purple — spans above frames 3 & 4 (z ≈ 0.25 → 0.41)
  spawnNeonStrip({ x: -0.264, y: 0.868, z: 0.33 }, 0.22, 0x6600cc);
}

function spawnNeonStrip(pos, length, color) {
  // Glowing mesh
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.005, 0.005, length),
    new THREE.MeshBasicMaterial({ color })
  );
  mesh.position.set(pos.x, pos.y, pos.z);
  scene.add(mesh);

  // Illuminating point light
  const light = new THREE.PointLight(color, 0.8, 0.45);
  light.position.set(pos.x, pos.y, pos.z);
  light.baseIntensity = 0.8;
  scene.add(light);
  neonAnimLights.push(light);
}

// Subtle neon flicker — called from animate()
function animateNeon() {
  if (!neonAnimLights.length) return;
  const t = Date.now() * 0.0015;
  neonAnimLights.forEach((l, i) => {
    l.intensity = l.baseIntensity + Math.sin(t + i * 1.7) * 0.12;
  });
}

// ═══════════════════════════════════════════════════════════════════════════
//  MAN CAVE — CANVAS ARTWORK GENERATORS
// ═══════════════════════════════════════════════════════════════════════════

function createHamiltonTexture() {
  const W = 512, H = 640;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#04020f');
  bg.addColorStop(1, '#08012a');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  // Radial purple glow
  const glow = ctx.createRadialGradient(W/2, 300, 0, W/2, 300, 280);
  glow.addColorStop(0, 'rgba(102,0,204,0.45)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);

  // Diagonal speed lines
  ctx.save();
  for (let i = 0; i < 18; i++) {
    ctx.strokeStyle = `rgba(247,201,72,${0.02 + i * 0.008})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(i * 32 - 80, 0);
    ctx.lineTo(i * 32 + 280, H);
    ctx.stroke();
  }
  ctx.restore();

  // Giant "44"
  ctx.save();
  ctx.font = 'bold 230px Impact, Arial Black, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const numGrad = ctx.createLinearGradient(W/2, 140, W/2, 380);
  numGrad.addColorStop(0, '#ffe566');
  numGrad.addColorStop(0.5, '#f7c948');
  numGrad.addColorStop(1, '#c8960c');
  ctx.shadowColor = 'rgba(247,201,72,0.9)';
  ctx.shadowBlur  = 45;
  ctx.fillStyle   = numGrad;
  ctx.fillText('44', W/2, 270);
  ctx.restore();

  // "HAMILTON"
  ctx.save();
  ctx.font = 'bold 52px Arial Black, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(255,255,255,0.4)'; ctx.shadowBlur = 10;
  ctx.fillText('HAMILTON', W/2, 410);
  ctx.restore();

  // "LEWIS" smaller
  ctx.font = '26px Arial, sans-serif';
  ctx.fillStyle = 'rgba(247,201,72,0.85)';
  ctx.textAlign = 'center';
  ctx.fillText('L E W I S', W/2, 452);

  // Thin gold divider
  ctx.fillStyle = '#6600cc'; ctx.fillRect(0, 486, W, 3);

  // Bottom dark panel
  const bot = ctx.createLinearGradient(0, 490, 0, H);
  bot.addColorStop(0, '#1a0040'); bot.addColorStop(1, '#0d0025');
  ctx.fillStyle = bot; ctx.fillRect(0, 489, W, H - 489);

  // "7× WORLD CHAMPION"
  ctx.font = 'bold 22px Arial, sans-serif';
  ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center';
  ctx.fillText('7× WORLD CHAMPION', W/2, 544);
  ctx.font = '16px Arial, sans-serif';
  ctx.fillStyle = 'rgba(247,201,72,0.7)';
  ctx.fillText('F O R M U L A  1', W/2, 578);

  // Click-me hint
  ctx.font = '13px Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillText('CLICK TO VIEW PROJECTS', W/2, 618);

  return new THREE.CanvasTexture(cv);
}

function createFerrariTexture() {
  const W = 512, H = 512;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');

  // Ferrari red base
  ctx.fillStyle = '#b80000'; ctx.fillRect(0, 0, W, H);

  // Bright diagonal panel
  ctx.fillStyle = '#dc0000';
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(W, 0);
  ctx.lineTo(W, 390); ctx.lineTo(0, 480);
  ctx.closePath(); ctx.fill();

  // Dark vignette
  const vig = ctx.createRadialGradient(W/2, H/2, 60, W/2, H/2, 320);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);

  // Gold top rule
  ctx.fillStyle = '#f7c948'; ctx.fillRect(60, 36, W - 120, 5);

  // "SCUDERIA"
  ctx.font = 'bold 32px Arial, sans-serif';
  ctx.fillStyle = '#f7c948'; ctx.textAlign = 'center';
  ctx.letterSpacing = '6px';
  ctx.fillText('SCUDERIA', W/2, 72);

  // "FERRARI"
  ctx.save();
  ctx.font = 'bold 88px Impact, Arial Black, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 18;
  ctx.textAlign = 'center';
  ctx.fillText('FERRARI', W/2, 175);
  ctx.restore();

  // "EST. 1929"
  ctx.font = '20px Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.textAlign = 'center';
  ctx.fillText('EST. 1929', W/2, 215);

  // Shield badge
  ctx.save();
  ctx.translate(W/2, 330);
  ctx.scale(1.1, 1.1);
  // Shield outline
  ctx.beginPath();
  ctx.moveTo(0, -65); ctx.lineTo(55, -65);
  ctx.lineTo(55, 15);
  ctx.bezierCurveTo(55, 55, 0, 72, 0, 72);
  ctx.bezierCurveTo(0, 72, -55, 55, -55, 15);
  ctx.lineTo(-55, -65); ctx.closePath();
  ctx.fillStyle   = '#f7c948';
  ctx.fill();
  ctx.strokeStyle = '#c8960c'; ctx.lineWidth = 2; ctx.stroke();
  // "SF" inside shield
  ctx.font = 'bold 54px serif';
  ctx.fillStyle = '#8f0000'; ctx.textAlign = 'center';
  ctx.fillText('SF', 0, 22);
  ctx.restore();

  // Gold bottom strip
  ctx.fillStyle = '#f7c948'; ctx.fillRect(0, 464, W, 6);

  // "FORMULA 1 RACING"
  ctx.font = 'bold 20px Arial, sans-serif';
  ctx.fillStyle = '#f7c948'; ctx.textAlign = 'center';
  const darkPanel = ctx.createLinearGradient(0, 470, 0, H);
  darkPanel.addColorStop(0, '#5a0000'); darkPanel.addColorStop(1, '#3a0000');
  ctx.fillStyle = darkPanel; ctx.fillRect(0, 470, W, H - 470);
  ctx.fillStyle = '#f7c948';
  ctx.fillText('FORMULA 1 RACING', W/2, 500);

  // Italian flag stripe
  const fw = W / 3;
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = '#009246'; ctx.fillRect(0, 508, fw, 4);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(fw, 508, fw, 4);
  ctx.fillStyle = '#ce2b37'; ctx.fillRect(fw * 2, 508, fw, 4);
  ctx.globalAlpha = 1;

  return new THREE.CanvasTexture(cv);
}

function createF1CircuitTexture() {
  const W = 512, H = 512;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');

  // Night background
  ctx.fillStyle = '#05060e'; ctx.fillRect(0, 0, W, H);

  // Starfield
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.7 + 0.1})`;
    ctx.beginPath();
    ctx.arc(Math.random() * W, Math.random() * H * 0.45, Math.random() * 1.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // "FORMULA 1" header gradient text
  ctx.save();
  const headerGrad = ctx.createLinearGradient(0, 0, W, 0);
  headerGrad.addColorStop(0, '#dc0000');
  headerGrad.addColorStop(0.5, '#ff4400');
  headerGrad.addColorStop(1, '#dc0000');
  ctx.font = 'bold 40px Arial Black, sans-serif';
  ctx.fillStyle = headerGrad; ctx.textAlign = 'center';
  ctx.fillText('FORMULA 1', W/2, 52);
  ctx.restore();
  ctx.font = '16px Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.textAlign = 'center';
  ctx.fillText('GRAND PRIX CIRCUIT', W/2, 78);

  // Circuit track
  ctx.save();
  ctx.translate(W/2, 290);

  // Track shadow
  ctx.shadowColor = 'rgba(220,0,0,0.3)'; ctx.shadowBlur = 12;
  ctx.strokeStyle = '#cccccc'; ctx.lineWidth = 20;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(-155, -75);
  ctx.lineTo(155, -75);
  ctx.arcTo(200, -75, 200, -35, 40);
  ctx.arcTo(200, 50, 155, 80, 42);
  ctx.lineTo(-80, 80);
  ctx.bezierCurveTo(-120, 80, -120, 120, -90, 120);
  ctx.bezierCurveTo(-60, 120, -60, 80, -30, 80);
  ctx.arcTo(-195, 80, -195, -75, 110);
  ctx.arcTo(-195, -95, -155, -75, 35);
  ctx.closePath();
  ctx.stroke();

  // Centre dashes
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 12]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Start/Finish line
  ctx.fillStyle = '#ffffff'; ctx.fillRect(-158, -88, 5, 22);
  ctx.fillStyle = '#dc0000'; ctx.fillRect(-153, -88, 5, 22);
  ctx.restore();

  // Race stats bottom panel
  ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(0, 440, W, 72);
  ctx.fillStyle = 'rgba(220,0,0,0.7)'; ctx.fillRect(0, 440, W, 3);

  ctx.font = 'bold 12px monospace';
  ctx.fillStyle = '#dc0000'; ctx.textAlign = 'left';
  ctx.fillText('CIRCUIT LENGTH: 5.891 KM', 18, 461);
  ctx.fillText('RACE LAPS: 52', 18, 479);
  ctx.fillText('RECORD: 1:15.144', 18, 497);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#f7c948';
  ctx.fillText('TOP SPEED: 350 KM/H', W - 18, 461);
  ctx.fillText('0-100: 2.6 SECONDS', W - 18, 479);
  ctx.fillText('G-FORCE: 6G', W - 18, 497);

  return new THREE.CanvasTexture(cv);
}

function createSpeedArtTexture() {
  const W = 512, H = 512;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');

  // Black base
  ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, W, H);

  // Checkered flag strip — top
  const sq = 36;
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < Math.ceil(W / sq); col++)
      if ((row + col) % 2 === 0) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(col * sq, row * sq, sq, sq);
      }

  // Motion blur — radiate from right-center
  for (let i = 0; i < 35; i++) {
    const y   = 130 + i * 11;
    const len = 120 + Math.random() * 220;
    ctx.strokeStyle = `rgba(220,${Math.round(i * 2)},0,${0.04 + i * 0.02})`;
    ctx.lineWidth   = 2.5 + Math.random() * 2;
    ctx.beginPath();
    ctx.moveTo(W, y); ctx.lineTo(W - len, y + Math.random() * 4 - 2);
    ctx.stroke();
  }
  for (let i = 0; i < 20; i++) {
    const y   = 140 + i * 14;
    const len = 60 + Math.random() * 130;
    ctx.strokeStyle = `rgba(255,255,255,${0.03 + i * 0.015})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y); ctx.lineTo(len, y); ctx.stroke();
  }

  // Ghost "1" watermark
  ctx.font = 'bold 340px Impact, sans-serif';
  ctx.fillStyle = 'rgba(220,0,0,0.1)';
  ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.fillText('1', W/2, H + 30);

  // "FORMULA"
  ctx.save();
  ctx.font = 'bold 68px Impact, Arial Black, sans-serif';
  const fg = ctx.createLinearGradient(0, 280, W, 340);
  fg.addColorStop(0, '#dc0000'); fg.addColorStop(0.6, '#ff4400'); fg.addColorStop(1, '#dc0000');
  ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText('FORMULA', W/2, 330);
  ctx.restore();

  // "ONE"
  ctx.save();
  ctx.font = 'bold 120px Impact, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(220,0,0,0.8)'; ctx.shadowBlur = 22;
  ctx.textAlign = 'center';
  ctx.fillText('ONE', W/2, 440);
  ctx.restore();

  // Checkered strip — bottom
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < Math.ceil(W / sq); col++)
      if ((row + col) % 2 === 0) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(col * sq, H - (row + 1) * sq, sq, sq);
      }

  return new THREE.CanvasTexture(cv);
}


// ═══════════════════════════════════════════════════════════════════════════
//  FLOATING PARTICLES — tiny sparks drifting upward
// ═══════════════════════════════════════════════════════════════════════════
function createFloatingParticles() {
  const count = 70;
  const geo   = new THREE.BufferGeometry();
  const pos   = new Float32Array(count * 3);
  particleVelocities = [];

  for (let i = 0; i < count; i++) {
    pos[i * 3]     = (Math.random() - 0.5) * 1.4;
    pos[i * 3 + 1] = Math.random() * 1.2;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 1.4;
    particleVelocities.push({
      x: (Math.random() - 0.5) * 0.00025,
      y: 0.00015 + Math.random() * 0.0004,
      z: (Math.random() - 0.5) * 0.00025,
    });
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));

  // Alternate red + gold colours
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    if (i % 2 === 0) { colors[i*3]=0.86; colors[i*3+1]=0;    colors[i*3+2]=0; }    // red
    else             { colors[i*3]=0.97; colors[i*3+1]=0.788; colors[i*3+2]=0.28; } // gold
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.PointsMaterial({
    size: 0.0048,
    vertexColors: true,
    transparent: true,
    opacity: 0.65,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  particleSystem = new THREE.Points(geo, mat);
  scene.add(particleSystem);
}

function updateParticles() {
  if (!particleSystem) return;
  const arr   = particleSystem.geometry.attributes.position.array;
  const count = arr.length / 3;
  for (let i = 0; i < count; i++) {
    arr[i * 3]     += particleVelocities[i].x;
    arr[i * 3 + 1] += particleVelocities[i].y;
    arr[i * 3 + 2] += particleVelocities[i].z;
    // reset at ceiling
    if (arr[i * 3 + 1] > 1.3) {
      arr[i * 3]     = (Math.random() - 0.5) * 1.4;
      arr[i * 3 + 1] = 0;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 1.4;
    }
  }
  particleSystem.geometry.attributes.position.needsUpdate = true;
}


// ═══════════════════════════════════════════════════════════════════════════
//  COMMAND PALETTE  (⌘K / Ctrl+K)
// ═══════════════════════════════════════════════════════════════════════════
function initCommandPalette() {
  const palette  = document.getElementById('cmd-palette');
  const input    = document.getElementById('cmd-input');
  const list     = document.getElementById('cmd-list');
  const backdrop = document.getElementById('cmd-backdrop');

  if (!palette || !input || !list) return;

  const COMMANDS = [
    { group: 'Navigate',  icon: '🏠', label: 'Home',              hint: 'Reset camera',       run: () => resetCamera() },
    { group: 'Navigate',  icon: '👤', label: 'About Me',           hint: 'Open the book',      run: () => { disableOrbitControls(); cameraToAbout(); gsap.delayedCall(1.5, enableCloseBtn); } },
    { group: 'Navigate',  icon: '🏁', label: 'Projects',           hint: 'View all projects',  run: () => openProjects() },
    { group: 'Navigate',  icon: '📧', label: 'Contact',            hint: 'Send an email',      run: () => { window.location.href = 'mailto:Akinfolarin.d3v@gmail.com'; } },
    { group: 'Theme',     icon: '🌙', label: 'Toggle Dark Mode',   hint: 'Day / night',        run: () => { theme = theme === 'light' ? 'dark' : 'light'; switchTheme(theme); } },
    { group: 'Links',     icon: '▶️', label: 'YouTube Channel',    hint: 'HackingFolarin',     run: () => window.open('https://www.youtube.com/@HackingFolarin', '_blank') },
    { group: 'Links',     icon: '💼', label: 'LinkedIn',            hint: 'Professional',       run: () => window.open('https://www.linkedin.com/in/akinfolarin-dev-232993245', '_blank') },
    { group: 'Links',     icon: '📸', label: 'Instagram',           hint: '@akinfolarin.dev',   run: () => window.open('https://www.instagram.com/akinfolarin.dev', '_blank') },
    { group: 'Man Cave',  icon: '🏎', label: 'Lewis Hamilton #44',  hint: 'Seven time champ',  run: () => window.open('https://www.lewishamilton.com', '_blank') },
    { group: 'Man Cave',  icon: '🐎', label: 'Ferrari F1',          hint: 'Scuderia Ferrari',  run: () => window.open('https://www.ferrari.com/en-EN/formula1', '_blank') },
  ];

  let activeIndex  = 0;
  let filtered     = [...COMMANDS];

  function renderList(cmds) {
    list.innerHTML = '';
    let lastGroup = '';
    cmds.forEach((cmd, i) => {
      if (cmd.group !== lastGroup) {
        const label = document.createElement('li');
        label.className = 'cmd-group-label';
        label.textContent = cmd.group;
        list.appendChild(label);
        lastGroup = cmd.group;
      }
      const li = document.createElement('li');
      li.className = 'cmd-item' + (i === activeIndex ? ' active' : '');
      li.setAttribute('role', 'option');
      li.innerHTML = `
        <span class="cmd-item-icon">${cmd.icon}</span>
        <span class="cmd-item-label">${cmd.label}</span>
        <span class="cmd-item-hint">${cmd.hint}</span>
      `;
      li.addEventListener('click', () => { cmd.run(); closePalette(); });
      list.appendChild(li);
    });
  }

  function openPalette() {
    palette.removeAttribute('hidden');
    input.value = '';
    activeIndex = 0;
    filtered = [...COMMANDS];
    renderList(filtered);
    requestAnimationFrame(() => input.focus());
  }
  function closePalette() { palette.setAttribute('hidden', ''); input.blur(); }

  input.addEventListener('input', () => {
    const q = input.value.toLowerCase();
    filtered = COMMANDS.filter(c =>
      c.label.toLowerCase().includes(q) || c.group.toLowerCase().includes(q)
    );
    activeIndex = 0;
    renderList(filtered);
  });

  input.addEventListener('keydown', e => {
    const items = list.querySelectorAll('.cmd-item');
    if (e.key === 'ArrowDown') {
      activeIndex = Math.min(activeIndex + 1, filtered.length - 1);
      items.forEach((el, i) => el.classList.toggle('active', i === activeIndex));
      items[activeIndex]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      activeIndex = Math.max(activeIndex - 1, 0);
      items.forEach((el, i) => el.classList.toggle('active', i === activeIndex));
      items[activeIndex]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      if (filtered[activeIndex]) { filtered[activeIndex].run(); closePalette(); }
    } else if (e.key === 'Escape') {
      closePalette();
    }
  });

  // Open triggers
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      palette.hasAttribute('hidden') ? openPalette() : closePalette();
    }
    if (e.key === 'Escape' && !palette.hasAttribute('hidden')) closePalette();
  });
  document.querySelectorAll('.cmd-trigger').forEach(btn =>
    btn.addEventListener('click', e => { e.preventDefault(); openPalette(); })
  );
  if (backdrop) backdrop.addEventListener('click', closePalette);
}


// ═══════════════════════════════════════════════════════════════════════════
//  INTRO MODAL
// ═══════════════════════════════════════════════════════════════════════════
function initIntroModal() {
  const modal   = document.getElementById('intro-modal');
  const closeBtn = document.getElementById('modal-close');
  const helpBtn  = document.getElementById('help-btn');
  if (!modal) return;

  function show() { modal.style.display = 'flex'; modal.classList.add('show'); }
  function hide() {
    modal.classList.remove('show');
    modal.classList.add('hide');
    setTimeout(() => { modal.style.display = 'none'; modal.classList.remove('hide'); }, 300);
  }

  show();
  closeBtn?.addEventListener('click', hide);
  helpBtn?.addEventListener('click', show);

  // Also close on backdrop click
  modal.addEventListener('click', e => { if (e.target === modal) hide(); });
}


// ─── CLOSE BTN / CONTACT / RESIZE (unchanged) ─────────────────────────────
document.getElementById('close-btn').addEventListener('click', e => {
  e.preventDefault(); resetCamera();
});

document.getElementById('contact-btn').addEventListener('click', e => {
  e.preventDefault();
  document.querySelector('.contact-menu__dropdown')
    .classList.toggle('contact-menu__dropdown--open');
});
document.addEventListener('mouseup', e => {
  const cont = document.querySelector('.contact-menu');
  if (!cont.contains(e.target))
    cont.querySelector('.contact-menu__dropdown').classList.remove('contact-menu__dropdown--open');
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

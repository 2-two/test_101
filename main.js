import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xeeeeee);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 5, 10);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

const ambientLight = new THREE.AmbientLight(0x404040, 1.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(0, 0, 10);
directionalLight.rotation.set(0, -90, 0);
scene.add(directionalLight);

const directionalLight1 = new THREE.DirectionalLight(0xffffff, 1);
directionalLight1.position.set(0, 0, -10);
directionalLight1.rotation.set(0, 90, 0);
scene.add(directionalLight1);

// const gridHelper = new THREE.GridHelper(20, 20);
// scene.add(gridHelper);

// const axesHelper = new THREE.AxesHelper(5);
// scene.add(axesHelper);


let femurMesh = null;
const stlLoader = new STLLoader();

const femurMaterial = new THREE.MeshPhongMaterial({
  color: 0x00aaff,
  specular: 0x111111,
  shininess: 100,
  transparent: true,
  opacity: 0.8,
});

stlLoader.load(
  './models/Right_Femur.stl',
  (geometry) => {
    femurMesh = new THREE.Mesh(geometry, femurMaterial);
    femurMesh.scale.set(0.01, 0.01, 0.01);
    femurMesh.rotation.set(-Math.PI / 2 + 0.5 * Math.PI / 180, 0, 0);
    femurMesh.position.set(1, -9, -1);

    scene.add(femurMesh);
    console.log('Femur model loaded.');
  },
  (xhr) => {
    if (xhr.lengthComputable) {
      const percentComplete = (xhr.loaded / xhr.total) * 100;
      console.log(`Loading Femur: ${percentComplete.toFixed(2)}% complete`);
    }
  },
  (error) => {
    console.error('Error loading Femur:', error);
  }
);



const landmarkButtons = [
  { name: 'Femur Center', id: 'femurCenterBtn', group: 1 },
  { name: 'Hip Center', id: 'hipCenterBtn', group: 1 },
  { name: 'Femur Proximal Canal', id: 'femurProximalCanalBtn', group: 2 },
  { name: 'Femur Distal Canal', id: 'femurDistalCanalBtn', group: 2 },
  { name: 'Medial Epicondyle', id: 'medialEpicondyleBtn', group: 3 },
  { name: 'Lateral Epicondyle', id: 'lateralEpicondyleBtn', group: 3 },
  { name: 'Distal Medial Pt', id: 'distalMedialPtBtn', group: 4 },
  { name: 'Distal Lateral Pt', id: 'distalLateralPtBtn', group: 4 },
  { name: 'Posterior Medial Pt', id: 'posteriorMedialPtBtn', group: 5 },
  { name: 'Posterior Lateral Pt', id: 'posteriorLateralPtBtn', group: 5 },
];

let activeButton = null;
let activeLandmark = null;
const landmarks = {};
let lines = [];


const groupColors = {
  1: 0x0000ff, 
  2: 0x00ff00, 
  3: 0xffff00, 
  4: 0xffa500, 
  5: 0x800080, 
};

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();


const transformControls = new TransformControls(camera, renderer.domElement);
transformControls.setMode('translate');
scene.add(transformControls);

transformControls.addEventListener('dragging-changed', (event) => {
  controls.enabled = !event.value;
});

const landmarkGeometry = new THREE.SphereGeometry(0.05, 16, 16);
const landmarkMaterial = (color) => new THREE.MeshBasicMaterial({ color: color });

const bottomControls = document.getElementById('bottomControls');
const backBtn = document.getElementById('backBtn');

backBtn.addEventListener('click', () => {
  if (activeLandmark) {
    transformControls.detach();
    activeLandmark = null;
  }

  backBtn.style.display = 'none';
  enableAllButtons();
  disableRaycaster();
});

const updateBtn = document.getElementById('updateBtn');

updateBtn.addEventListener('click', () => {

  const pairs = [
    { pair: ['femurCenterBtn', 'hipCenterBtn'], name: 'Mechanical Axis', group: 1 },
    { pair: ['femurProximalCanalBtn', 'femurDistalCanalBtn'], name: 'Anatomical Axis', group: 2 },
    { pair: ['medialEpicondyleBtn', 'lateralEpicondyleBtn'], name: 'TEA', group: 3 },
    { pair: ['posteriorMedialPtBtn', 'posteriorLateralPtBtn'], name: 'PCA', group: 5 },
    // ['distalMedialPtBtn', 'distalLateralPtBtn'] remoce this shit to prevent line between button7 and button8
  ];

  pairs.forEach(({ pair, name, group }) => {
    const [startId, endId] = pair;
    if (landmarks[startId] && landmarks[endId]) {
      const existingLine = lines.find(l => {
        const lStart = l.userData.startId;
        const lEnd = l.userData.endId;
        return (lStart === startId && lEnd === endId) || (lStart === endId && lEnd === startId);
      });

      if (existingLine) {
        console.log(`Line "${name}" between ${startId} and ${endId} already exists.`);
        return;
      }

      
      const points = [];
      points.push(new THREE.Vector3(
        landmarks[startId].position.x,
        landmarks[startId].position.y,
        landmarks[startId].position.z
      ));
      points.push(new THREE.Vector3(
        landmarks[endId].position.x,
        landmarks[endId].position.y,
        landmarks[endId].position.z
      ));

      const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
      const lineMaterial = new THREE.LineBasicMaterial({ color: groupColors[group], linewidth: 2 });
      const line = new THREE.Line(lineGeometry, lineMaterial);
      line.userData = { startId, endId, name, group };
      scene.add(line);
      lines.push(line);
      console.log(`Line "${name}" drawn between ${startId} and ${endId}.`);
    }
  });
});

const processBtn = document.getElementById('processBtn');

let perpendicularPlane = null;
let varusValgusPlane = null;
let flexionExtensionPlane = null;
let rotationPivotVarusValgus = null;
let rotationPivotFlexionExtension = null;
let rotationDegreeVarusValgus = 0;
let rotationDegreeFlexionExtension = 0;

const MAX_ROTATION = 10; 
const MIN_ROTATION = -10;

let processCompleted = false;
let originalTEA = null;

processBtn.addEventListener('click', () => {
  if (processCompleted) {
    alert('Process has already been completed.');
    return;
  }

  if (Object.keys(landmarks).length !== landmarkButtons.length) {
    alert('Please place all landmarks before processing.');
    return;
  }

  const requiredLandmarks = ['femurCenterBtn', 'hipCenterBtn', 'medialEpicondyleBtn', 'lateralEpicondyleBtn'];
  for (const lm of requiredLandmarks) {
    if (!landmarks[lm]) {
      alert(`Missing landmark: ${lm}`);
      return;
    }
  }

  try {
    createPerpendicularPlane();
    projectTEALine();
    create10mmLines();
    createVarusValgusPlane();
    createFlexionExtensionPlane(); 
    setupRotationControls();
    enableRotationButtons(); 
    processCompleted = true;
    processBtn.disabled = true;
    console.log('Processing completed successfully.');
  } catch (error) {
    console.error('Error during processing:', error);
    alert('An error occurred during processing. Please check the console for details.');
  }
});

function createPerpendicularPlane() {
  const femurCenter = landmarks['femurCenterBtn'].position.clone();
  const hipCenter = landmarks['hipCenterBtn'].position.clone();

  const mechanicalAxis = new THREE.Vector3().subVectors(hipCenter, femurCenter).normalize();
  console.log('Mechanical Axis:', mechanicalAxis);

  const planeSize = 2;
  const planeGeometry = new THREE.PlaneGeometry(planeSize, planeSize);
  const planeMaterial = new THREE.MeshBasicMaterial({
    color: 0xffff00,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.5,
  });
  perpendicularPlane = new THREE.Mesh(planeGeometry, planeMaterial);
  perpendicularPlane.position.copy(femurCenter);

  const defaultNormal = new THREE.Vector3(0, 0, 1);

  const quaternion = new THREE.Quaternion().setFromUnitVectors(defaultNormal, mechanicalAxis);
  perpendicularPlane.quaternion.copy(quaternion);
  scene.add(perpendicularPlane);
  console.log('Perpendicular plane (Varus/Valgus) created and oriented correctly.');
}

function create10mmLines() {
  const femurCenter = landmarks['femurCenterBtn'].position.clone();

 
  const lineLength = 0.1; // 10mm
  const line10mmGeometryX = new THREE.BufferGeometry().setFromPoints([
    femurCenter.clone(),
    femurCenter.clone().add(new THREE.Vector3(lineLength, 0, 0))
  ]);
  const line10mmMaterialX = new THREE.LineBasicMaterial({ color: 0xff00ff, linewidth: 2 });
  const line10mmX = new THREE.Line(line10mmGeometryX, line10mmMaterialX);
  line10mmX.name = 'X-axis 10mm Line';
  scene.add(line10mmX);
  console.log('10mm line in X direction created.');


  const line10mmGeometryZ = new THREE.BufferGeometry().setFromPoints([
    femurCenter.clone(),
    femurCenter.clone().add(new THREE.Vector3(0, 0, lineLength))
  ]);
  const line10mmMaterialZ = new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 2 });
  const line10mmZ = new THREE.Line(line10mmGeometryZ, line10mmMaterialZ);
  line10mmZ.name = 'Z-axis 10mm Line';
  scene.add(line10mmZ);
  console.log('10mm line in Z direction created.');
}

function createVarusValgusPlane() {
  if (!perpendicularPlane) {
    throw new Error('Perpendicular plane is not defined.');
  }

  const planeSize = 2; 
  const varusValgusGeometry = new THREE.PlaneGeometry(planeSize, planeSize);
  const varusValgusMaterial = new THREE.MeshBasicMaterial({
    color: 0xff0000,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.5,
  });
  varusValgusPlane = new THREE.Mesh(varusValgusGeometry, varusValgusMaterial);

  const femurCenter = landmarks['femurCenterBtn'].position.clone();
  varusValgusPlane.position.copy(femurCenter);
  varusValgusPlane.quaternion.copy(perpendicularPlane.quaternion);
  scene.add(varusValgusPlane);
  console.log('Varus/Valgus plane created and positioned correctly.');
}

function createFlexionExtensionPlane() {
  if (!perpendicularPlane) {
    throw new Error('Perpendicular plane is not defined.');
  }

  const planeSize = 2;
  const flexionExtensionGeometry = new THREE.PlaneGeometry(planeSize, planeSize);
  const flexionExtensionMaterial = new THREE.MeshBasicMaterial({
    color: 0x00ff00, 
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.5,
  });
  flexionExtensionPlane = new THREE.Mesh(flexionExtensionGeometry, flexionExtensionMaterial);

  const femurCenter = landmarks['femurCenterBtn'].position.clone();
  flexionExtensionPlane.position.copy(femurCenter);
  flexionExtensionPlane.quaternion.copy(perpendicularPlane.quaternion);
  scene.add(flexionExtensionPlane);
  console.log('Flexion/Extension plane created and positioned correctly.');
}

function projectTEALine() {
  const femurCenter = landmarks['femurCenterBtn'].position.clone();
  const medialEpicondyle = landmarks['medialEpicondyleBtn'].position.clone();
  const lateralEpicondyle = landmarks['lateralEpicondyleBtn'].position.clone();

  if (!originalTEA) {
    originalTEA = new THREE.Vector3().subVectors(lateralEpicondyle, medialEpicondyle).normalize();
    console.log('Original TEA Vector:', originalTEA);
  }

  const planeNormal = new THREE.Vector3();
  perpendicularPlane.getWorldDirection(planeNormal).normalize();
  console.log('Perpendicular Plane Normal:', planeNormal);

  const TEAProjected = originalTEA.clone().sub(
    planeNormal.clone().multiplyScalar(originalTEA.dot(planeNormal))
  ).normalize();
  console.log('TEA Projected on Perpendicular Plane:', TEAProjected);

  const TEAPoint1 = femurCenter.clone();
  const TEAPoint2 = TEAPoint1.clone().add(TEAProjected.clone().multiplyScalar(1)); 
  const TEALineGeometry = new THREE.BufferGeometry().setFromPoints([TEAPoint1, TEAPoint2]);
  const TEALineMaterial = new THREE.LineBasicMaterial({ color: 0x0000ff, linewidth: 2 });
  const TEALine = new THREE.Line(TEALineGeometry, TEALineMaterial);
  scene.add(TEALine);
  console.log('TEA line projected on perpendicular plane.');
}

function setupRotationControls() {
  const femurCenter = landmarks['femurCenterBtn'].position.clone();
  const lineLengthZ = 0.1;
  const lineLengthX = 0.1;

  rotationPivotVarusValgus = new THREE.Object3D();
  rotationPivotVarusValgus.position.copy(femurCenter.clone().add(new THREE.Vector3(0, 0, lineLengthZ)));
  scene.add(rotationPivotVarusValgus);
  varusValgusPlane.position.sub(rotationPivotVarusValgus.position);
  rotationPivotVarusValgus.add(varusValgusPlane);

  rotationPivotFlexionExtension = new THREE.Object3D();
  rotationPivotFlexionExtension.position.copy(femurCenter.clone().add(new THREE.Vector3(lineLengthX, 0, 0)));
  scene.add(rotationPivotFlexionExtension);

  flexionExtensionPlane.position.sub(rotationPivotFlexionExtension.position);
  rotationPivotFlexionExtension.add(flexionExtensionPlane);

  console.log('Rotation controls set up for both Varus/Valgus and Flexion/Extension planes.');
}

function enableRotationButtons() {
  const rotatePlusVarusValgus = document.getElementById('rotatePlusVarusValgus');
  const rotateMinusVarusValgus = document.getElementById('rotateMinusVarusValgus');

  const rotatePlusFlexionExtension = document.getElementById('rotatePlusFlexionExtension');
  const rotateMinusFlexionExtension = document.getElementById('rotateMinusFlexionExtension');

  
  rotatePlusVarusValgus.disabled = false;
  rotateMinusVarusValgus.disabled = false;
  rotatePlusFlexionExtension.disabled = false;
  rotateMinusFlexionExtension.disabled = false;

  console.log('Rotation buttons enabled for Varus/Valgus and Flexion/Extension.');
}

const rotatePlusVarusValgusBtn = document.getElementById('rotatePlusVarusValgus');
const rotateMinusVarusValgusBtn = document.getElementById('rotateMinusVarusValgus');
const rotationDegreeVarusValgusDisplay = document.getElementById('rotationDegreeVarusValgus');

const rotatePlusFlexionExtensionBtn = document.getElementById('rotatePlusFlexionExtension');
const rotateMinusFlexionExtensionBtn = document.getElementById('rotateMinusFlexionExtension');
const rotationDegreeFlexionExtensionDisplay = document.getElementById('rotationDegreeFlexionExtension');

let isSynchronizingRotation = false;

function rotatePlaneVarusValgus(direction) {
  if (!rotationPivotVarusValgus || !varusValgusPlane) return;

  const rotationStep = 1;
  const newRotation = rotationDegreeVarusValgus + direction * rotationStep;

    if (newRotation > MAX_ROTATION || newRotation < MIN_ROTATION) {
    alert(`Rotation limited to ±${MAX_ROTATION} degrees.`);
    return; 
  }

  rotationDegreeVarusValgus += direction * rotationStep;
    rotationPivotVarusValgus.rotateZ(THREE.MathUtils.degToRad(direction * rotationStep));
    rotationDegreeVarusValgusDisplay.innerText = `${rotationDegreeVarusValgus}°`;

  if (!isSynchronizingRotation) {
    isSynchronizingRotation = true;
    rotatePlaneFlexionExtension(direction);
    isSynchronizingRotation = false;
  }
}

function rotatePlaneFlexionExtension(direction) {
  if (!rotationPivotFlexionExtension || !flexionExtensionPlane) return;

  const rotationStep = 1;
  const newRotation = rotationDegreeFlexionExtension + direction * rotationStep;

  if (newRotation > MAX_ROTATION || newRotation < MIN_ROTATION) {
    alert(`Rotation limited to ±${MAX_ROTATION} degrees.`);
    return;
  }
    rotationDegreeFlexionExtension += direction * rotationStep;
    rotationPivotFlexionExtension.rotateX(THREE.MathUtils.degToRad(direction * rotationStep));

    rotationDegreeFlexionExtensionDisplay.innerText = `${rotationDegreeFlexionExtension}°`;

  if (!isSynchronizingRotation) {
    isSynchronizingRotation = true;
    rotatePlaneVarusValgus(direction);
    isSynchronizingRotation = false;
  }
}

rotatePlusVarusValgusBtn.addEventListener('click', () => {
  rotatePlaneVarusValgus(1);
});

rotateMinusVarusValgusBtn.addEventListener('click', () => {
  rotatePlaneVarusValgus(-1);
});

rotatePlusFlexionExtensionBtn.addEventListener('click', () => {
  rotatePlaneFlexionExtension(1);
});

rotateMinusFlexionExtensionBtn.addEventListener('click', () => {
  rotatePlaneFlexionExtension(-1);
});

landmarkButtons.forEach((btn) => {
  const button = document.getElementById(btn.id);
  if (!button) {
    console.warn(`Button with ID "${btn.id}" not found.`);
    return;
  }

  button.addEventListener('click', () => {
    if (activeButton === btn.id) {
      activeButton = null;
      button.classList.remove('active');
      backBtn.style.display = 'none';
      disableRaycaster();
      enableAllButtons();
      return;
    }

    if (activeButton) {
      const prevButton = document.getElementById(activeButton);
      if (prevButton) prevButton.classList.remove('active');
    }

    activeButton = btn.id;
    button.classList.add('active');
    backBtn.style.display = 'inline-block';
    disableAllButtonsExcept(activeButton);

    if (landmarks[activeButton]) {
      transformControls.attach(landmarks[activeButton]);
      activeLandmark = landmarks[activeButton];
      console.log(`attached to existing landmark: ${activeButton}`);
    } else {
      enableRaycaster();
    }
    checkAllLandmarksPlaced();
  });
});

function enableRaycaster() {
  window.addEventListener('click', onClick, false);
  console.log('raycaster come to life.');
}

function disableRaycaster() {
  window.removeEventListener('click', onClick, false);
  console.log('raycaster die die die.');
}

function disableAllButtonsExcept(activeId) {
  landmarkButtons.forEach((btn) => {
    if (btn.id !== activeId) {
      const button = document.getElementById(btn.id);
      if (button) button.disabled = true;
    }
  });
}

function enableAllButtons() {
  landmarkButtons.forEach((btn) => {
    const button = document.getElementById(btn.id);
    if (button) button.disabled = false;
  });
}

function checkAllLandmarksPlaced() {
  const allPlaced = landmarkButtons.every(btn => landmarks[btn.id]);
  const processBtn = document.getElementById('processBtn');
  if (allPlaced) {
    processBtn.disabled = false;
    console.log('All landmarks placed. "Process" button enabled.');
  } else {
    processBtn.disabled = true;
    console.log('Not all landmarks placed. "Process" button disabled.');
  }
}

function onClick(event) {
  event.preventDefault();

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  if (!femurMesh) return;

  const intersects = raycaster.intersectObject(femurMesh, true);

  if (intersects.length > 0 && activeButton && !landmarks[activeButton]) {
    const point = intersects[0].point;
    placeLandmark(activeButton, point);
    disableRaycaster();
    backBtn.style.display = 'inline-block';
    checkAllLandmarksPlaced();
  }
}

function placeLandmark(buttonId, position) {
  const landmark = landmarkButtons.find(btn => btn.id === buttonId);
  const color = groupColors[landmark.group] || 0xff0000;
  const sphere = new THREE.Mesh(landmarkGeometry, landmarkMaterial(color));
  sphere.position.copy(position);
  scene.add(sphere);
  console.log(`Landmark "${buttonId}" placed at:`, position);

  landmarks[buttonId] = sphere;
  transformControls.attach(sphere);
  activeLandmark = sphere;
}

const opacitySlider = document.getElementById('opacitySlider');

opacitySlider.addEventListener('input', (event) => {
  const opacityValue = parseFloat(event.target.value);
  if (femurMesh) {
    femurMesh.material.opacity = opacityValue;
    femurMesh.material.transparent = opacityValue < 1 ? true : false;
    femurMesh.material.needsUpdate = true;
  }
});

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

transformControls.addEventListener('change', () => {
});

transformControls.addEventListener('objectChange', () => {
  if (!transformControls.object) {
    enableAllButtons();
    backBtn.style.display = 'none';
  }
});

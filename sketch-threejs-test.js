// npx vite

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const scene = new THREE.Scene();
const lineMaterial = new THREE.LineBasicMaterial( { color: 0x0000ff } );
const basicMaterial = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
// const camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 1, 500 );
// camera.position.set( 0, 0, 100 );
// camera.lookAt( 0, 0, 0 );

const loader = new GLTFLoader();
let fence;
let fenceMesh;

loader.load(
	// resource URL
	'assets/fence_square/fence_square.gltf',
	// called when the resource is loaded
	function ( gltf ) {

        fence = gltf.scene;
        
        
        fenceMesh = fence.children[0].children[0].children[0];
        fenceMesh.material = lineMaterial;
        scene.add( fenceMesh );

        console.log(fenceMesh);

		// gltf.animations; // Array<THREE.AnimationClip>
		// gltf.scene; // THREE.Group
		// gltf.scenes; // Array<THREE.Group>
		// gltf.cameras; // Array<THREE.Camera>
		// gltf.asset; // Object

	},
	// called while loading is progressing
	function ( xhr ) {

		console.log( ( xhr.loaded / xhr.total * 100 ) + '% loaded' );

	},
	// called when loading has errors
	function ( error ) {

		console.log( 'An error happened' );

	}
);




const renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );

const geometry = new THREE.BoxGeometry( 1, 1, 1 );

const cube = new THREE.Mesh( geometry, basicMaterial );
//scene.add( cube );


const points = [];
points.push( new THREE.Vector3( - 10, 0, 0 ) );
points.push( new THREE.Vector3( 0, 10, 0 ) );
points.push( new THREE.Vector3( 10, 0, 0 ) );

const linesGeometry = new THREE.BufferGeometry().setFromPoints( points );
const line = new THREE.Line( geometry, basicMaterial );

scene.add( line );

const light = new THREE.DirectionalLight( 0xFFFFFF );
scene.add(light);

camera.position.z = 100;

function animate() {
	requestAnimationFrame( animate );

    if (fence)
    {
        //fence.rotation.x += 0.01;
        fenceMesh.rotation.y = 3.14;
    }
    

	renderer.render( scene, camera );
}
animate();

// import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
// import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// const controls = new OrbitControls( camera, renderer.domElement );
// const loader = new GLTFLoader();
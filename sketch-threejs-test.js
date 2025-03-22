// npx canvas-sketch-cli sketch-threejs-test.js --open

const canvasSketch = require('canvas-sketch');
const { polylinesToSVG } = require('canvas-sketch-util/penplot');
const Random = require('canvas-sketch-util/random');

// Делаем THREE глобальным
global.THREE = require('three');

// Загружаем глобальные версии модулей
require('three/examples/js/loaders/GLTFLoader');
require('three/examples/js/controls/OrbitControls');

const lines = [];
let modelLoaded = false;

// Создаем сцену THREE.js для предпросмотра
const scene = new THREE.Scene();
const previewCamera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);  // aspect = 1 для квадратного канваса
previewCamera.position.z = 3;

const renderer = new THREE.WebGLRenderer({ antialias: true });
const size = Math.min(window.innerWidth / 2, window.innerHeight / 2);  // берем минимальную сторону для квадрата
renderer.setSize(size, size);
renderer.setClearColor(0xffffff, 1);
document.body.appendChild(renderer.domElement);

// Обновляем aspect при изменении размера окна
window.addEventListener('resize', () => {
    const size = Math.min(window.innerWidth / 2, window.innerHeight / 2);
    renderer.setSize(size, size);
    previewCamera.aspect = 1;
    previewCamera.updateProjectionMatrix();
});

const controls = new THREE.OrbitControls(previewCamera, renderer.domElement);
controls.addEventListener('change', () => {
    // Очищаем существующие линии и пересчитываем их с новой проекцией
    if (modelLoaded && currentGeometry) {
        lines.length = 0;
        extractLinesFromGeometry(currentGeometry);
    }
});

let currentGeometry;
let previewMesh;

// Создаем процедурную геометрию
function createProceduralSphereGeometry(radius, segments) {
    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    const indices = [];
    
    // Создаем вершины
    for (let lat = 0; lat <= segments; lat++) {
        const theta = lat * Math.PI / segments;
        const sinTheta = Math.sin(theta);
        const cosTheta = Math.cos(theta);

        for (let lon = 0; lon <= segments; lon++) {
            const phi = lon * 2 * Math.PI / segments;
            
            // Координаты точки на сфере
            const x = radius * sinTheta * Math.cos(phi);
            const y = radius * cosTheta;
            const z = radius * sinTheta * Math.sin(phi);
            
            vertices.push(x, y, z);
        }
    }

    // Создаем индексы для треугольников
    for (let lat = 0; lat < segments; lat++) {
        for (let lon = 0; lon < segments; lon++) {
            const first = lat * (segments + 1) + lon;
            const second = first + segments + 1;
            
            // Первый треугольник
            indices.push(first);
            indices.push(second);
            indices.push(first + 1);
            
            // Второй треугольник
            indices.push(second);
            indices.push(second + 1);
            indices.push(first + 1);
        }
    }
    
    // Создаем буферные атрибуты
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    
    // Вычисляем нормали
    geometry.computeVertexNormals();
    
    return geometry;
}

// Создаем геометрию с помощью нашей процедурной функции
const radius = 1;  // радиус сферы
const segments = 32;  // количество сегментов (влияет на детализацию)
currentGeometry = createProceduralSphereGeometry(radius, segments);

// Добавляем шум к вершинам
const positions = currentGeometry.attributes.position;
const normals = currentGeometry.attributes.normal;

for (let i = 0; i < positions.count; i++) {
    const normal = new THREE.Vector3(
        normals.getX(i),
        normals.getY(i),
        normals.getZ(i)
    );
    
    const pos = new THREE.Vector3(
        positions.getX(i),
        positions.getY(i),
        positions.getZ(i)
    );

    // Создаем шум на основе позиции вершины
    const noise = Random.noise3D(
        pos.x * 2,
        pos.y * 2,
        pos.z * 2,
        0.5, // частота
        0.15  // амплитуда
    );

    // Добавляем высокочастотный шум
    const noiseHF = Random.noise3D(
        pos.x * 8,
        pos.y * 8,
        pos.z * 8,
        1, // частота
        0.05  // амплитуда
    );

    // Смещаем вершину по нормали
    pos.add(normal.multiplyScalar(noise + noiseHF));
    
    positions.setXYZ(i, pos.x, pos.y, pos.z);
}

// Обновляем нормали после деформации
currentGeometry.computeVertexNormals();

// Создаем меш для предпросмотра
const wireframeMaterial = new THREE.LineBasicMaterial({ color: 0x000000 });
const wireframeGeometry = new THREE.WireframeGeometry(currentGeometry);
previewMesh = new THREE.LineSegments(wireframeGeometry, wireframeMaterial);
scene.add(previewMesh);

// Извлекаем линии из геометрии
extractLinesFromGeometry(currentGeometry);
modelLoaded = true;

function extractLinesFromGeometry(geometry) {
    const edges = new Set();
    const positions = geometry.attributes.position.array;
    const indices = geometry.index ? geometry.index.array : null;
    
    // Матрица модели
    const modelMatrix = new THREE.Matrix4();
    modelMatrix.makeRotationY(Math.PI);
    
    // Получаем актуальные матрицы из камеры
    const projMatrix = previewCamera.projectionMatrix;
    const viewMatrix = previewCamera.matrixWorldInverse;
    
    // Позиция камеры в мировых координатах
    const cameraPos = new THREE.Vector3();
    previewCamera.getWorldPosition(cameraPos);
    
    // Функция для создания уникального ключа ребра
    const getEdgeKey = (v1, v2) => {
        const [a, b] = v1 < v2 ? [v1, v2] : [v2, v1];
        return `${a}-${b}`;
    };

    // Хранилище для нормалей граней
    const faceNormals = new Map();
    // Хранилище для центров граней
    const faceCenters = new Map();

    // Если есть индексы, используем их
    if (indices) {
        for (let i = 0; i < indices.length; i += 3) {
            const v1 = indices[i];
            const v2 = indices[i + 1];
            const v3 = indices[i + 2];
            
            // Вычисляем точки грани
            const p1 = new THREE.Vector3(
                positions[v1 * 3],
                positions[v1 * 3 + 1],
                positions[v1 * 3 + 2]
            );
            const p2 = new THREE.Vector3(
                positions[v2 * 3],
                positions[v2 * 3 + 1],
                positions[v2 * 3 + 2]
            );
            const p3 = new THREE.Vector3(
                positions[v3 * 3],
                positions[v3 * 3 + 1],
                positions[v3 * 3 + 2]
            );

            // Применяем матрицу модели к точкам
            p1.applyMatrix4(modelMatrix);
            p2.applyMatrix4(modelMatrix);
            p3.applyMatrix4(modelMatrix);

            // Вычисляем центр грани после трансформации
            const center = new THREE.Vector3()
                .addVectors(p1, p2)
                .add(p3)
                .multiplyScalar(1/3);

            // Вычисляем нормаль грани после трансформации
            const normal = new THREE.Vector3()
                .crossVectors(
                    new THREE.Vector3().subVectors(p2, p1),
                    new THREE.Vector3().subVectors(p3, p1)
                )
                .normalize();

            // Сохраняем нормаль и центр для каждого ребра грани
            const currentEdges = [
                getEdgeKey(v1, v2),
                getEdgeKey(v2, v3),
                getEdgeKey(v3, v1)
            ];

            currentEdges.forEach(edge => {
                if (!faceNormals.has(edge)) {
                    faceNormals.set(edge, []);
                    faceCenters.set(edge, []);
                }
                faceNormals.get(edge).push(normal);
                faceCenters.get(edge).push(center);
            });

            currentEdges.forEach(edge => edges.add(edge));
        }
    }

    // Преобразуем рёбра в линии для canvas-sketch
    edges.forEach(edge => {
        const [v1, v2] = edge.split('-').map(Number);
        
        const point1 = new THREE.Vector3(
            positions[v1 * 3], 
            positions[v1 * 3 + 1], 
            positions[v1 * 3 + 2]
        );
        const point2 = new THREE.Vector3(
            positions[v2 * 3], 
            positions[v2 * 3 + 1], 
            positions[v2 * 3 + 2]
        );

        // Применяем матрицу модели к точкам
        point1.applyMatrix4(modelMatrix);
        point2.applyMatrix4(modelMatrix);

        // Проверяем видимость грани
        const normals = faceNormals.get(edge);
        const centers = faceCenters.get(edge);
        if (normals && centers) {
            // Проверяем все грани, содержащие это ребро
            let hasVisibleFace = false;
            for (let i = 0; i < normals.length; i++) {
                const normal = normals[i];
                const center = centers[i];
                const toCam = new THREE.Vector3().subVectors(cameraPos, center);
                if (normal.dot(toCam) > 0) {
                    hasVisibleFace = true;
                    break;  // Достаточно одной видимой грани
                }
            }
            
            if (!hasVisibleFace) {
                return;  // Пропускаем ребро только если все грани невидимы
            }
        }

        // Применяем матрицу вида и проекции
        const viewProjMatrix = new THREE.Matrix4();
        viewProjMatrix.multiplyMatrices(projMatrix, viewMatrix);
        
        const point1Projected = point1.clone().applyMatrix4(viewProjMatrix);
        const point2Projected = point2.clone().applyMatrix4(viewProjMatrix);

        // Проверяем видимость точек
        if (point1Projected.z < -1 || point1Projected.z > 1 || point2Projected.z < -1 || point2Projected.z > 1) {
            return;
        }

        // Преобразуем из NDC в координаты холста
        const canvasSize = 6.5; // размер холста в см
        
        // Нормализуем координаты
        const x1 = (point1Projected.x + 1) * 0.5;
        const y1 = (-point1Projected.y + 1) * 0.5;
        const x2 = (point2Projected.x + 1) * 0.5;
        const y2 = (-point2Projected.y + 1) * 0.5;

        lines.push([
            [x1 * canvasSize, y1 * canvasSize],
            [x2 * canvasSize, y2 * canvasSize]
        ]);
    });
}

// Анимация для THREE.js предпросмотра
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, previewCamera);
}
animate();

const sketch = () => {
    return ({ context, width, height }) => {
        if (!modelLoaded) return;

        // Очищаем холст
        context.fillStyle = 'white';
        context.fillRect(0, 0, width, height);

        // Рисуем линии
        lines.forEach(line => {
            context.beginPath();
            line.forEach(p => context.lineTo(p[0], p[1]));
            context.strokeStyle = 'black';
            context.lineWidth = 0.01;
            context.lineJoin = 'round';
            context.lineCap = 'round';
            context.stroke();
        });

        return [
            context.canvas,
            {
                data: polylinesToSVG(lines, {
                    width,
                    height,
                    units: 'cm'
                }),
                extension: '.svg'
            }
        ];
    };
};

canvasSketch(sketch, {
    dimensions: [6.5, 6.5],
    pixelsPerInch: 300,
    units: 'cm',
});
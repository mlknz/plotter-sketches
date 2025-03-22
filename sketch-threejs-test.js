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

function createProceduralCubesGeometry(radius, segments) {
    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    const indices = [];
    
    // Параметры спирали
    const turns = 2;
    const pointsPerTurn = segments / 2;
    const totalPoints = turns * pointsPerTurn;
    const cubeSize = 0.1;
    const compressionXZ = 0.4;
    
    // Создаем две спирали (как в ДНК)
    for (let spiral = 0; spiral < 2; spiral++) {
        const spiralOffset = spiral * Math.PI;
        
        // Создаем точки вдоль спирали
        for (let i = 0; i < totalPoints; i++) {
            const t = i / totalPoints;
            const theta = 2 * Math.PI * turns * t + spiralOffset;
            const phi = Math.PI * t;
            
            // Базовая точка на спирали
            const sinPhi = Math.sin(phi);
            const cosPhi = Math.cos(phi);
            const localX = radius * sinPhi * Math.cos(theta) * compressionXZ;
            const localY = radius * cosPhi;
            const localZ = radius * sinPhi * Math.sin(theta) * compressionXZ;
            
            // Создаем матрицу для куба
            const cubeMatrix = new THREE.Matrix4();
            const cubePos = new THREE.Vector3(localX, localY, localZ);
            
            // Вычисляем направление к центру спирали
            const dirToCenter = new THREE.Vector3().copy(cubePos).multiplyScalar(-1).normalize();
            const upVector = new THREE.Vector3(0, 1, 0);
            const rightVector = new THREE.Vector3().crossVectors(upVector, dirToCenter).normalize();
            const rotatedUpVector = new THREE.Vector3().crossVectors(dirToCenter, rightVector);
            
            // Создаем матрицу ориентации куба
            cubeMatrix.makeBasis(rightVector, rotatedUpVector, dirToCenter);
            cubeMatrix.setPosition(cubePos);
            
            // Создаем вершины куба
            const cubeVertices = [
                [-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1],
                [-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1]
            ];
            
            const startIndex = vertices.length / 3;
            
            // Трансформируем и добавляем вершины куба
            cubeVertices.forEach(([x, y, z]) => {
                const vertex = new THREE.Vector3(
                    x * cubeSize * 0.5,
                    y * cubeSize * 0.5,
                    z * cubeSize * 0.5
                ).applyMatrix4(cubeMatrix);
                
                vertices.push(vertex.x, vertex.y, vertex.z);
            });
            
            // Индексы для граней куба
            const cubeIndices = [
                0, 1, 2, 0, 2, 3,  // нижняя грань
                4, 6, 5, 4, 7, 6,  // верхняя грань
                0, 4, 1, 1, 4, 5,  // боковые грани
                1, 5, 2, 2, 5, 6,
                2, 6, 3, 3, 6, 7,
                3, 7, 0, 0, 7, 4
            ];
            
            cubeIndices.forEach(idx => {
                indices.push(startIndex + idx);
            });
        }
    }
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    
    return geometry;
}

// Создаем геометрию с помощью нашей процедурной функции
const radius = 1;
const segments = 48; // уменьшаем количество сегментов, так как теперь у нас кубы
currentGeometry = createProceduralCubesGeometry(radius, segments);

// Добавляем небольшой шум к вершинам
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

    // Создаем минимальный шум для небольшого разнообразия
    const noise = Random.noise3D(
        pos.x * 2,
        pos.y * 2,
        pos.z * 2,
        0.5,
        0.02  // уменьшаем амплитуду шума
    );

    // Смещаем вершину по нормали
    pos.add(normal.multiplyScalar(noise));
    
    positions.setXYZ(i, pos.x, pos.y, pos.z);
}

// Обновляем нормали после деформации
currentGeometry.computeVertexNormals();

// Создаем меш для предпросмотра
const colors = [0xff0000, 0x00ff00, 0x0000ff]; // красный, зеленый, синий
const shifts = [ // смещения для каждой копии
    new THREE.Vector3(0.02, 0.02, 0),   // смещение для первой копии
    new THREE.Vector3(0, 0, 0),         // оригинальная позиция
    new THREE.Vector3(-0.02, -0.02, 0)  // смещение для второй копии
];

// Создаем три отдельных меша для разных цветов
const meshes = [];
for (let i = 0; i < 3; i++) {
    const wireframeMaterial = new THREE.LineBasicMaterial({ 
        color: colors[i],
        opacity: 0.7,
        transparent: true
    });
    const wireframeGeometry = new THREE.WireframeGeometry(currentGeometry);
    const mesh = new THREE.LineSegments(wireframeGeometry, wireframeMaterial);
    
    // Применяем смещение
    mesh.position.copy(shifts[i]);
    
    scene.add(mesh);
    meshes.push(mesh);
}

// Извлекаем линии из геометрии и устанавливаем флаг загрузки
extractLinesFromGeometry(currentGeometry);
modelLoaded = true;

// Извлекаем линии из геометрии с RGB-shift
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

    // Хранилище для нормалей и центров граней
    const faceNormals = new Map();
    const faceCenters = new Map();
    
    // Собираем все рёбра
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

    // Создаем случайную перестановку цветов для каждого куба
    const colorPermutations = [
        ['#ff0000', '#00ff00', '#0000ff'],
        ['#ff0000', '#0000ff', '#00ff00'],
        ['#00ff00', '#ff0000', '#0000ff'],
        ['#00ff00', '#0000ff', '#ff0000'],
        ['#0000ff', '#ff0000', '#00ff00'],
        ['#0000ff', '#00ff00', '#ff0000']
    ];

    // Преобразуем рёбра в линии для canvas-sketch
    let cubeIndex = 0;
    edges.forEach(edge => {
        const [v1, v2] = edge.split('-').map(Number);
        
        // Выбираем случайную перестановку цветов для текущего куба
        const colorOrder = colorPermutations[Math.floor(cubeIndex / 12) % colorPermutations.length];
        
        // Создаем три копии линии с разными смещениями и цветами
        for (let i = 0; i < 3; i++) {
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

            // Применяем все трансформации в правильном порядке
            point1.applyMatrix4(modelMatrix);
            point2.applyMatrix4(modelMatrix);

            // Добавляем RGB-shift смещение в мировом пространстве
            const shift = shifts[i];
            point1.x += shift.x;
            point1.y += shift.y;
            point2.x += shift.x;
            point2.y += shift.y;

            // Применяем матрицу вида и проекции
            const viewProjMatrix = new THREE.Matrix4().multiplyMatrices(projMatrix, viewMatrix);
            const point1Projected = point1.clone().applyMatrix4(viewProjMatrix);
            const point2Projected = point2.clone().applyMatrix4(viewProjMatrix);

            // Проверяем видимость в пространстве отсечения
            if (point1Projected.z < -1 || point1Projected.z > 1 ||
                point2Projected.z < -1 || point2Projected.z > 1) {
                continue;
            }

            // Преобразуем в координаты холста с правильным масштабированием
            const canvasSize = 6.5;
            const margin = 0.2; // добавляем небольшой отступ от краев
            const scale = canvasSize - margin * 2;

            // Используем правильное преобразование из NDC в координаты холста
            const x1 = margin + (point1Projected.x + 1) * 0.5 * scale;
            const y1 = margin + (-point1Projected.y + 1) * 0.5 * scale;
            const x2 = margin + (point2Projected.x + 1) * 0.5 * scale;
            const y2 = margin + (-point2Projected.y + 1) * 0.5 * scale;

            lines.push({
                points: [
                    [x1, y1],
                    [x2, y2]
                ],
                color: colorOrder[i]
            });
        }
        
        if ((cubeIndex + 1) % 12 === 0) {
            // Увеличиваем счетчик только после обработки всех рёбер одного куба
            cubeIndex++;
        }
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

        // Рисуем линии с разными цветами
        lines.forEach(line => {
            context.beginPath();
            line.points.forEach(p => context.lineTo(p[0], p[1]));
            context.strokeStyle = line.color;
            context.lineWidth = 0.01;
            context.lineJoin = 'round';
            context.lineCap = 'round';
            context.stroke();
        });

        // Модифицируем SVG экспорт для поддержки цветов
        const colors = ['#ff0000', '#00ff00', '#0000ff'];
        const colorNames = ['red', 'green', 'blue'];
        
        // Создаем отдельные массивы линий для каждого цвета
        const coloredLines = colors.map(color => 
            lines.filter(line => line.color === color)
                 .map(line => line.points)
        );

        return [
            context.canvas,
            // Экспортируем три отдельных SVG файла
            ...coloredLines.map((lines, i) => ({
                data: polylinesToSVG(lines, {
                    width,
                    height,
                    units: 'cm',
                    attributes: { stroke: colors[i] }
                }),
                extension: `.${colorNames[i]}.svg`
            }))
        ];
    };
};

canvasSketch(sketch, {
    dimensions: [6.5, 6.5],
    pixelsPerInch: 300,
    units: 'cm',
});
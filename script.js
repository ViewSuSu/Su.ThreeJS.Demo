// 全局变量
let scene, camera, renderer, controls;
let currentModel = null;
let isRotating = true;
let animationId = null;
let selectedObject = null;
let modelParameters = new Map(); // 存储构件参数
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();

console.log('Three.js版本:', THREE.REVISION);

// 初始化场景
function init() {
    console.log('初始化Three.js场景...');
    
    try {
        // 1. 创建场景
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x1a1a2e);
        console.log('场景创建成功');

        // 2. 创建相机
        const aspect = window.innerWidth / window.innerHeight;
        camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
        camera.position.set(15, 10, 15);
        console.log('相机创建成功');

        // 3. 创建渲染器
        renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            alpha: true
        });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        const container = document.getElementById('canvas-container');
        if (!container) {
            throw new Error('找不到canvas-container元素');
        }
        container.appendChild(renderer.domElement);
        console.log('渲染器创建并添加到DOM成功');

        // 4. 添加轨道控制器 - 配置中键平移
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.minDistance = 1;
        controls.maxDistance = 100;
        
        // 配置鼠标按键：中键平移，右键无操作避免浏览器冲突
        controls.mouseButtons = {
            LEFT: THREE.MOUSE.ROTATE,    // 左键旋转
            MIDDLE: THREE.MOUSE.PAN,     // 中键平移（左右拖拽）
            RIGHT: null                  // 右键无操作
        };
        
        console.log('轨道控制器创建成功');

        // 5. 添加灯光
        setupLights();
        console.log('灯光设置完成');

        // 6. 创建参数显示面板
        createParametersPanel();
        console.log('参数面板创建完成');

        // 7. 设置事件监听器
        setupEventListeners();
        console.log('事件监听器设置完成');

        // 8. 开始动画循环
        startAnimation();
        console.log('动画循环启动');

        // 9. 先加载DRACO解码器，然后加载模型
        loadDRACODecoder().then(() => {
            loadModel();
        }).catch(error => {
            console.error('DRACO解码器加载失败:', error);
            showError('DRACO解码器加载失败，尝试加载未压缩模型...');
            loadModel();
        });

    } catch (error) {
        console.error('初始化过程中发生错误:', error);
        updateLoadingStatus('初始化失败: ' + error.message);
        showError('初始化失败: ' + error.message);
    }
}

// 创建参数显示面板
function createParametersPanel() {
    // 移除已存在的参数面板
    const existingPanel = document.getElementById('parameters-panel');
    if (existingPanel) {
        existingPanel.remove();
    }
    
    // 创建参数面板
    const parametersPanel = document.createElement('div');
    parametersPanel.id = 'parameters-panel';
    parametersPanel.className = 'parameters-panel';
    parametersPanel.innerHTML = `
        <div class="parameters-header">
            <h4>构件参数信息</h4>
            <button id="close-parameters" class="close-btn">×</button>
        </div>
        <div class="parameters-content">
            <div class="object-info" id="object-info">请选择构件</div>
            <div class="parameters-list" id="parameters-list">
                <div class="no-parameters">单击场景中的构件查看参数</div>
            </div>
        </div>
    `;
    
    // 添加到场景容器中
    const canvasContainer = document.getElementById('canvas-container');
    canvasContainer.appendChild(parametersPanel);
    
    // 添加关闭按钮事件
    document.getElementById('close-parameters').addEventListener('click', () => {
        parametersPanel.style.display = 'none';
        clearHighlight(); // 清除高亮
    });
}

// 加载DRACO解码器
function loadDRACODecoder() {
    return new Promise((resolve, reject) => {
        if (typeof THREE.DRACOLoader === 'undefined') {
            console.log('DRACOLoader未定义，尝试动态加载...');
            
            // 动态创建script标签加载DRACOLoader
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/DRACOLoader.js';
            script.onload = () => {
                console.log('DRACOLoader加载成功');
                resolve();
            };
            script.onerror = () => {
                console.warn('DRACOLoader加载失败，模型可能无法正常加载');
                reject(new Error('DRACOLoader加载失败'));
            };
            document.head.appendChild(script);
        } else {
            console.log('DRACOLoader已可用');
            resolve();
        }
    });
}

// 加载模型 - 支持GLB和GLTF格式
function loadModel() {
    if (typeof THREE.GLTFLoader === 'undefined') {
        const errorMsg = 'GLTFLoader不可用，请检查Three.js版本';
        console.error(errorMsg);
        updateLoadingStatus(errorMsg);
        showError(errorMsg);
        return;
    }

    updateLoadingStatus('正在检测模型文件...');
    showError(''); // 清除之前的错误信息
    
    const loader = new THREE.GLTFLoader();
    
    // 设置DRACOLoader（如果可用）
    if (typeof THREE.DRACOLoader !== 'undefined') {
        try {
            const dracoLoader = new THREE.DRACOLoader();
            // 使用CDN上的Draco解码器文件
            dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/libs/draco/gltf/');
            loader.setDRACOLoader(dracoLoader);
            console.log('DRACOLoader设置成功');
        } catch (dracoError) {
            console.warn('DRACOLoader初始化失败:', dracoError);
        }
    } else {
        console.warn('DRACOLoader不可用，如果模型使用Draco压缩可能会加载失败');
    }
    
    // 纹理路径与模型文件同级，都在models文件夹中
    loader.setPath('./models/');
    
    // 优先尝试加载GLB格式，如果失败则尝试GLTF格式
    tryLoadGLBFormat(loader);
}

// 尝试加载GLB格式
function tryLoadGLBFormat(loader) {
    const glbFile = 'RST_basic_sample_project.glb';
    console.log('优先尝试加载GLB格式:', glbFile);
    updateLoadingStatus('正在加载GLB模型...');
    
    loader.load(glbFile, 
        // 加载成功回调
        (gltf) => {
            console.log('GLB模型加载成功!', gltf);
            onModelLoadSuccess(gltf, 'GLB');
        },
        // 加载进度回调
        (xhr) => {
            if (xhr.lengthComputable) {
                const percent = (xhr.loaded / xhr.total * 100).toFixed(1);
                updateLoadingStatus(`GLB模型加载中: ${percent}%`);
                console.log(`GLB加载进度: ${percent}%`);
            } else {
                updateLoadingStatus(`GLB模型加载中: ${(xhr.loaded / 1024 / 1024).toFixed(1)} MB`);
            }
        },
        // 加载失败回调
        (error) => {
            console.warn('GLB模型加载失败:', error);
            console.log('尝试加载GLTF格式...');
            tryLoadGLTFFormat(loader);
        }
    );
}

// 尝试加载GLTF格式
function tryLoadGLTFFormat(loader) {
    const gltfFile = 'abc.gltf';
    console.log('尝试加载GLTF格式:', gltfFile);
    updateLoadingStatus('正在加载GLTF模型...');
    
    loader.load(gltfFile, 
        // 加载成功回调
        (gltf) => {
            console.log('GLTF模型加载成功!', gltf);
            onModelLoadSuccess(gltf, 'GLTF');
        },
        // 加载进度回调
        (xhr) => {
            if (xhr.lengthComputable) {
                const percent = (xhr.loaded / xhr.total * 100).toFixed(1);
                updateLoadingStatus(`GLTF模型加载中: ${percent}%`);
                console.log(`GLTF加载进度: ${percent}%`);
            } else {
                updateLoadingStatus(`GLTF模型加载中: ${(xhr.loaded / 1024 / 1024).toFixed(1)} MB`);
            }
        },
        // 加载失败回调
        (error) => {
            console.error('GLTF模型也加载失败:', error);
            
            let errorMsg = `模型加载失败: ${error.message}`;
            
            // 提供更友好的错误信息
            if (error.message.includes('DRACOLoader') || error.message.includes('Draco')) {
                errorMsg += ' - 模型使用了Draco压缩，但解码器加载失败';
            } else if (error.message.includes('404')) {
                errorMsg += ' - 文件未找到，请检查模型文件路径';
            } else if (error.message.includes('texture') || error.message.includes('image')) {
                errorMsg += ' - 纹理文件加载失败，请检查纹理文件路径和格式';
            }
            
            updateLoadingStatus(errorMsg);
            showError(errorMsg);
            
            updateModelInfo('模型加载失败，请检查控制台');
            
            // 如果加载失败，创建一个简单的测试几何体
            createTestGeometry();
        }
    );
}

// 模型加载成功处理
function onModelLoadSuccess(gltf, format) {
    // 移除之前的模型
    if (currentModel) {
        scene.remove(currentModel);
    }
    
    currentModel = gltf.scene;
    
    // 把模型放进场景
    scene.add(currentModel);
    
    // 设置模型位置和缩放
    currentModel.position.set(0, 0, 0);
    currentModel.scale.set(1, 1, 1);
    
    // 启用阴影和设置可点击
    currentModel.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            
            // 为每个网格对象添加可点击标记
            child.userData.clickable = true;
            console.log('设置模型阴影:', child.name || '未命名网格');
        }
    });
    
    // 提取参数信息
    extractParameters(gltf);
    
    // 更新场景树
    updateSceneHierarchy();
    
    // 调整相机视角来适应模型
    fitCameraToModel();
    
    updateLoadingStatus(`${format}模型加载完成！`);
    updateModelInfo(`mx矮寨大桥（洞口）新 - 已加载 (${format}格式)`);
    hideLoadingScreen();
    
    console.log('模型已成功添加到场景');
}

// 从GLTF中提取参数信息
function extractParameters(gltf) {
    modelParameters.clear();
    
    console.log('开始提取参数信息...', gltf);
    
    // 遍历所有节点
    gltf.scene.traverse((child) => {
        let parameters = null;
        
        // 1. 检查userData.extras
        if (child.userData && child.userData.extras) {
            const extras = child.userData.extras;
            console.log(`检查 ${child.name} 的extras:`, extras);
            
            if (extras.Parameters) {
                parameters = extras.Parameters;
            } else if (extras.parameters) {
                parameters = extras.parameters;
            } else {
                // 直接检查extras中的参数
                for (const key in extras) {
                    if (key.toLowerCase().includes('parameter') && Array.isArray(extras[key])) {
                        parameters = extras[key];
                        break;
                    }
                }
            }
        }
        
        // 2. 检查节点本身的extras
        if (!parameters && child.extras) {
            console.log(`检查 ${child.name} 的child.extras:`, child.extras);
            if (child.extras.Parameters) {
                parameters = child.extras.Parameters;
            } else if (child.extras.parameters) {
                parameters = child.extras.parameters;
            }
        }
        
        // 3. 检查userData直接包含的参数
        if (!parameters && child.userData) {
            console.log(`检查 ${child.name} 的userData:`, child.userData);
            for (const key in child.userData) {
                if (key.toLowerCase().includes('parameter') && Array.isArray(child.userData[key])) {
                    parameters = child.userData[key];
                    break;
                }
            }
        }
        
        if (parameters) {
            modelParameters.set(child.uuid, parameters);
            console.log(`找到参数 for ${child.name || child.type}:`, parameters);
        }
    });
    
    console.log('参数提取完成，找到参数的对象数量:', modelParameters.size);
}

// 创建测试几何体（当模型加载失败时使用）
function createTestGeometry() {
    console.log('创建测试几何体...');
    
    // 移除之前的模型
    if (currentModel) {
        scene.remove(currentModel);
    }
    
    // 创建一个组来包含所有测试几何体
    currentModel = new THREE.Group();
    currentModel.name = '测试几何体';
    
    // 创建立方体
    const cubeGeometry = new THREE.BoxGeometry(2, 2, 2);
    const cubeMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x00aaff,
        metalness: 0.3,
        roughness: 0.4
    });
    const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
    cube.name = '立方体';
    cube.position.set(-3, 1, 0);
    cube.castShadow = true;
    cube.receiveShadow = true;
    cube.userData.clickable = true;
    
    // 创建球体
    const sphereGeometry = new THREE.SphereGeometry(1.5, 32, 32);
    const sphereMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xff4444,
        metalness: 0.2,
        roughness: 0.3
    });
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    sphere.name = '球体';
    sphere.position.set(3, 1.5, 0);
    sphere.castShadow = true;
    sphere.receiveShadow = true;
    sphere.userData.clickable = true;
    
    // 创建平面（地面）
    const planeGeometry = new THREE.PlaneGeometry(20, 20);
    const planeMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x333333,
        metalness: 0.1,
        roughness: 0.8
    });
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.name = '地面';
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = -1;
    plane.receiveShadow = true;
    plane.userData.clickable = true;
    
    // 添加到组中
    currentModel.add(cube);
    currentModel.add(sphere);
    currentModel.add(plane);
    
    // 添加到场景
    scene.add(currentModel);
    
    // 更新场景树
    updateSceneHierarchy();
    
    // 调整相机
    fitCameraToModel();
    
    updateLoadingStatus('测试几何体已创建');
    updateModelInfo('测试几何体 - 模型加载失败时使用');
    hideLoadingScreen();
    
    console.log('测试几何体创建完成');
}

// 更新场景层次结构树
function updateSceneHierarchy() {
    const hierarchyContainer = document.getElementById('scene-hierarchy');
    if (!hierarchyContainer) return;
    
    hierarchyContainer.innerHTML = '';
    
    // 创建场景根节点
    const sceneItem = createHierarchyItem('场景', 'scene', scene);
    hierarchyContainer.appendChild(sceneItem);
    
    // 递归遍历场景中的所有对象
    scene.children.forEach(child => {
        const childElement = createObjectHierarchy(child);
        sceneItem.querySelector('.hierarchy-children').appendChild(childElement);
    });
}

// 创建对象层次结构
function createObjectHierarchy(object) {
    // 如果是Mesh对象，不显示在树中，只显示其父级对象
    if (object.isMesh && object.parent && !object.parent.isScene) {
        return null;
    }
    
    const item = createHierarchyItem(
        object.name || object.type || '未命名对象',
        getObjectType(object),
        object
    );
    
    // 如果有子对象，递归创建
    if (object.children && object.children.length > 0) {
        const childrenContainer = item.querySelector('.hierarchy-children');
        object.children.forEach(child => {
            // 跳过Mesh对象，只显示其父级
            if (!child.isMesh || child.parent === object) {
                const childElement = createObjectHierarchy(child);
                if (childElement) {
                    childrenContainer.appendChild(childElement);
                }
            }
        });
    }
    
    return item;
}

// 获取对象类型
function getObjectType(object) {
    if (object.isMesh) return 'mesh';
    if (object.isLight) return 'light';
    if (object.isCamera) return 'camera';
    if (object.isGroup || object.isScene) return 'group';
    return 'unknown';
}

// 创建层次结构项
function createHierarchyItem(name, type, object) {
    const item = document.createElement('div');
    item.className = `hierarchy-item ${type}`;
    
    // 检查是否有参数
    const hasParameters = modelParameters.has(object.uuid);
    const paramIndicator = hasParameters ? ' 📊' : '';
    
    item.innerHTML = `
        <div class="hierarchy-name">${name}${paramIndicator}</div>
        <div class="hierarchy-children"></div>
    `;
    
    // 添加双击事件
    item.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        focusOnObject(object);
    });
    
    // 添加单击事件
    item.addEventListener('click', (e) => {
        e.stopPropagation();
        selectObject(object, item);
    });
    
    return item;
}

// 选择对象
function selectObject(object, element) {
    // 移除之前的选择
    document.querySelectorAll('.hierarchy-item.selected').forEach(item => {
        item.classList.remove('selected');
    });
    
    // 添加新选择
    if (element) {
        element.classList.add('selected');
    }
    
    selectedObject = object;
    
    // 更新模型信息
    updateModelInfo(`已选择: ${object.name || object.type || '未知对象'}`);
    
    // 显示参数信息
    displayParameters(object);
    
    // 高亮显示对象
    highlightObject(object);
    
    console.log('选择对象:', object);
}

// 显示参数信息
function displayParameters(object) {
    const objectInfo = document.getElementById('object-info');
    const parametersList = document.getElementById('parameters-list');
    const parametersPanel = document.getElementById('parameters-panel');
    
    if (!objectInfo || !parametersList || !parametersPanel) {
        console.error('参数面板元素未找到');
        return;
    }
    
    // 显示参数面板
    parametersPanel.style.display = 'block';
    
    const parameters = modelParameters.get(object.uuid);
    
    // 更新对象信息
    objectInfo.textContent = `对象: ${object.name || object.type || '未命名对象'}`;
    
    if (!parameters) {
        parametersList.innerHTML = '<div class="no-parameters">该构件没有参数信息</div>';
        return;
    }
    
    let html = '';
    
    // 处理参数数组 - 根据你提供的JSON结构
    if (Array.isArray(parameters)) {
        parameters.forEach((paramGroup, groupIndex) => {
            if (paramGroup && typeof paramGroup === 'object') {
                // 处理参数组：{"GroupName": "尺寸标注", "Parameters": [...]}
                if (paramGroup.GroupName && Array.isArray(paramGroup.Parameters)) {
                    // 添加参数组标题
                    html += `
                        <div class="parameter-group">
                            <div class="group-name">${paramGroup.GroupName}</div>
                            <div class="group-parameters">
                    `;
                    
                    // 添加组内参数
                    paramGroup.Parameters.forEach((param, paramIndex) => {
                        if (param && typeof param === 'object') {
                            // 处理参数项：{"value": "18.096", "name": "长度"}
                            if (param.name !== undefined && param.value !== undefined) {
                                html += `
                                    <div class="parameter-item">
                                        <span class="param-name">${param.name}</span>
                                        <span class="param-value">${param.value}</span>
                                    </div>
                                `;
                            }
                        }
                    });
                    
                    html += `
                            </div>
                        </div>
                    `;
                }
            }
        });
    }
    
    if (html === '') {
        parametersList.innerHTML = '<div class="no-parameters">参数格式无法解析</div>';
    } else {
        parametersList.innerHTML = html;
    }
}

// 定位到对象
function focusOnObject(object) {
    if (!object) return;
    
    // 计算对象的边界框
    const bbox = new THREE.Box3().setFromObject(object);
    const center = bbox.getCenter(new THREE.Vector3());
    const size = bbox.getSize(new THREE.Vector3());
    
    console.log(`定位到对象: ${object.name || '未命名'}`, center, size);
    
    // 计算合适的相机距离
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    let cameraDistance = Math.abs(maxDim / Math.sin(fov / 2));
    
    // 添加一些余量
    cameraDistance *= 1.5;
    
    // 计算相机位置（从当前视角方向看向对象中心）
    const direction = new THREE.Vector3()
        .subVectors(camera.position, controls.target)
        .normalize();
    
    const newCameraPosition = new THREE.Vector3()
        .copy(center)
        .add(direction.multiplyScalar(cameraDistance));
    
    // 平滑移动相机
    animateCameraToPosition(newCameraPosition, center);
    
    // 高亮显示对象
    highlightObject(object);
    
    updateModelInfo(`已定位到: ${object.name || object.type || '未知对象'}`);
}

// 动画移动相机到指定位置
function animateCameraToPosition(targetPosition, targetLookAt) {
    const startPosition = camera.position.clone();
    const startTarget = controls.target.clone();
    const duration = 1000; // 1秒
    let startTime = null;
    
    function animate(time) {
        if (!startTime) startTime = time;
        const elapsed = time - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // 使用缓动函数
        const easeProgress = easeOutCubic(progress);
        
        // 插值相机位置和目标
        camera.position.lerpVectors(startPosition, targetPosition, easeProgress);
        controls.target.lerpVectors(startTarget, targetLookAt, easeProgress);
        controls.update();
        
        if (progress < 1) {
            requestAnimationFrame(animate);
        }
    }
    
    requestAnimationFrame(animate);
}

// 缓动函数
function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

// 高亮对象
function highlightObject(object) {
    // 清除之前的高亮
    clearHighlight();
    
    // 高亮选中的对象
    object.traverse((child) => {
        if (child.isMesh) {
            // 保存原始材质
            child.userData.originalMaterial = child.material;
            
            // 创建高亮材质
            const highlightMaterial = new THREE.MeshBasicMaterial({
                color: 0x00ff00,
                transparent: true,
                opacity: 0.6,
                wireframe: false
            });
            
            child.material = highlightMaterial;
        }
    });
}

// 清除高亮
function clearHighlight() {
    scene.traverse((child) => {
        if (child.isMesh && child.userData.originalMaterial) {
            child.material = child.userData.originalMaterial;
            delete child.userData.originalMaterial;
        }
    });
}

// 处理鼠标点击事件
function onMouseClick(event) {
    // 计算鼠标在归一化设备坐标中的位置
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    // 更新射线投射器
    raycaster.setFromCamera(mouse, camera);
    
    // 计算与射线相交的对象
    const intersects = raycaster.intersectObjects(scene.children, true);
    
    if (intersects.length > 0) {
        const intersect = intersects[0];
        let selectedObject = intersect.object;
        
        // 向上查找具有参数的父级对象
        while (selectedObject && !modelParameters.has(selectedObject.uuid) && selectedObject.parent) {
            selectedObject = selectedObject.parent;
        }
        
        if (selectedObject && modelParameters.has(selectedObject.uuid)) {
            // 选择对象并显示参数
            selectObject(selectedObject);
            
            // 在场景树中高亮对应的项
            highlightTreeItem(selectedObject);
        } else {
            // 如果没有找到有参数的对象，清除选择
            clearSelection();
        }
    } else {
        // 点击空白处清除选择
        clearSelection();
    }
}

// 在场景树中高亮对应的项
function highlightTreeItem(object) {
    const hierarchyItems = document.querySelectorAll('.hierarchy-item');
    hierarchyItems.forEach(item => {
        item.classList.remove('selected');
    });
    
    // 查找对应的树项并高亮
    const objectUuid = object.uuid;
    const targetItem = document.querySelector(`[data-uuid="${objectUuid}"]`);
    if (targetItem) {
        targetItem.classList.add('selected');
    }
}

// 清除选择
function clearSelection() {
    // 清除高亮
    clearHighlight();
    
    // 隐藏参数面板
    const parametersPanel = document.getElementById('parameters-panel');
    if (parametersPanel) {
        parametersPanel.style.display = 'none';
    }
    
    // 清除树中的选择
    const hierarchyItems = document.querySelectorAll('.hierarchy-item');
    hierarchyItems.forEach(item => {
        item.classList.remove('selected');
    });
    
    // 更新模型信息
    updateModelInfo('未选择任何对象');
}

// 调整相机视角以适应模型
function fitCameraToModel() {
    if (!currentModel) return;
    
    const bbox = new THREE.Box3().setFromObject(currentModel);
    const center = bbox.getCenter(new THREE.Vector3());
    const size = bbox.getSize(new THREE.Vector3());
    
    console.log('模型边界框:', bbox);
    console.log('模型中心:', center);
    console.log('模型尺寸:', size);
    
    // 计算合适的相机距离
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / Math.sin(fov / 2));
    
    // 添加一些余量
    cameraZ *= 1.5;
    
    camera.position.set(center.x, center.y, center.z + cameraZ);
    controls.target.copy(center);
    controls.update();
    
    console.log('相机位置调整完成:', camera.position);
}

// 设置灯光
function setupLights() {
    // 环境光
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);

    // 方向光
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // 点光源
    const pointLight = new THREE.PointLight(0x00aaff, 0.5, 100);
    pointLight.position.set(-10, 10, 10);
    scene.add(pointLight);
}

// 增加照明
function enhanceLights() {
    const lights = [];
    scene.traverse(obj => {
        if (obj.isLight) lights.push(obj);
    });
    
    lights.forEach(light => scene.remove(light));
    
    // 更强的灯光
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
    directionalLight.position.set(10, 15, 10);
    directionalLight.castShadow = true;
    scene.add(directionalLight);
    
    const backLight = new THREE.DirectionalLight(0xffffff, 0.8);
    backLight.position.set(-10, 5, -10);
    scene.add(backLight);
    
    updateModelInfo('照明已增强');
    updateSceneHierarchy(); // 更新场景树
}

// 减少照明
function reduceLights() {
    const lights = [];
    scene.traverse(obj => {
        if (obj.isLight) lights.push(obj);
    });
    
    lights.forEach(light => scene.remove(light));
    
    // 更暗的灯光
    const ambientLight = new THREE.AmbientLight(0x404040, 0.3);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(10, 15, 10);
    directionalLight.castShadow = true;
    scene.add(directionalLight);
    
    updateModelInfo('照明已减弱');
    updateSceneHierarchy(); // 更新场景树
}

// 设置事件监听器
function setupEventListeners() {
    window.addEventListener('resize', onWindowResize);
    
    // 添加鼠标点击事件监听器
    renderer.domElement.addEventListener('click', onMouseClick);
    
    setTimeout(() => {
        document.getElementById('reset-view').addEventListener('click', resetView);
        document.getElementById('enhance-lights').addEventListener('click', enhanceLights);
        document.getElementById('reduce-lights').addEventListener('click', reduceLights);
        document.getElementById('toggle-rotation').addEventListener('click', toggleRotation);
        document.getElementById('reload-model').addEventListener('click', reloadModel);
        
        // 添加展开/收起按钮事件
        document.getElementById('expand-all').addEventListener('click', expandAll);
        document.getElementById('collapse-all').addEventListener('click', collapseAll);
        
        // 添加分隔条拖拽功能
        setupResizeHandle();
    }, 100);
}

// 设置分隔条拖拽功能
function setupResizeHandle() {
    const resizeHandle = document.getElementById('resize-handle');
    const sceneTree = document.getElementById('scene-tree');
    const canvasArea = document.getElementById('canvas-area');
    
    let isResizing = false;
    
    resizeHandle.addEventListener('mousedown', (e) => {
        isResizing = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        
        const containerRect = document.querySelector('.main-container').getBoundingClientRect();
        const newWidth = e.clientX - containerRect.left;
        
        if (newWidth > 250 && newWidth < containerRect.width - 400) {
            sceneTree.style.width = `${newWidth}px`;
        }
    });
    
    document.addEventListener('mouseup', () => {
        isResizing = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    });
}

// 展开所有层次结构
function expandAll() {
    document.querySelectorAll('.hierarchy-children').forEach(container => {
        container.style.display = 'block';
    });
}

// 收起所有层次结构
function collapseAll() {
    document.querySelectorAll('.hierarchy-children').forEach(container => {
        container.style.display = 'none';
    });
}

// 重新加载模型
function reloadModel() {
    updateLoadingStatus('重新加载模型中...');
    showError('');
    loadDRACODecoder().then(() => {
        loadModel();
    }).catch(() => {
        loadModel();
    });
}

// 开始动画循环
function startAnimation() {
    function animate() {
        animationId = requestAnimationFrame(animate);
        
        controls.update();
        
        if (currentModel && isRotating) {
            currentModel.rotation.y += 0.005;
        }
        
        renderer.render(scene, camera);
    }
    
    animate();
}

// 处理窗口大小变化
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// 隐藏加载界面
function hideLoadingScreen() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

// === 交互函数 ===
function resetView() {
    if (currentModel) {
        fitCameraToModel();
    } else {
        camera.position.set(15, 10, 15);
        controls.target.set(0, 0, 0);
        controls.update();
    }
    updateModelInfo('视角已重置');
}

function toggleRotation() {
    isRotating = !isRotating;
    const button = document.getElementById('toggle-rotation');
    button.textContent = isRotating ? '暂停旋转' : '继续旋转';
    updateModelInfo('自动旋转: ' + (isRotating ? '开启' : '关闭'));
}

function updateLoadingStatus(message) {
    const element = document.getElementById('loading-status');
    if (element) element.textContent = message;
}

function updateModelInfo(message) {
    const element = document.getElementById('model-info');
    if (element) element.textContent = message;
}

function showError(message) {
    const element = document.getElementById('error-info');
    if (element) {
        element.textContent = message;
        element.style.display = message ? 'block' : 'none';
    }
}

// 页面加载完成后初始化
window.addEventListener('load', init);

// 清理资源
window.addEventListener('beforeunload', () => {
    if (animationId) cancelAnimationFrame(animationId);
});
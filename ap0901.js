//
// 応用プログラミング 第9,10回 自由課題 (ap0901.js)
// G38436-2023 小林　イマデ千尋
//
"use strict"; // 厳格モード

// ライブラリをモジュールとして読み込む
import * as THREE from "three";
import { GUI } from "ili-gui";
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

// ３Ｄページ作成関数の定義
function init() {
  //テクスチャーローダー
  const textureLoader = new THREE.TextureLoader();
  // HTML要素を取得
  const titleScreen = document.getElementById('titleScreen');
  const startButton = document.getElementById('startButton');
  const gameOverScreen = document.getElementById('gameOverScreen');
  const menuButton = document.getElementById('menuButton');

  // スタートボタンのクリックイベント
  startButton.addEventListener('click', () => {
    titleScreen.style.display = 'none'; // タイトル画面を非表示
    gameOver = false;
    startCreate();
    render(); // ゲーム開始
  });

  //ゲームオーバー: メニューボタンのクリックイベント
  menuButton.addEventListener('click', () => {
    gameOverScreen.style.display = 'none';
    player.position.set(0, 0.01, 0); // 初期位置
    titleScreen.style.display = 'flex';
  });
  
  // シーン作成
  const scene = new THREE.Scene();

  // 制御変数の定義
  const param = {
    axes: false, // 座標軸
  };

  // GUIコントローラの設定
  const gui = new GUI();
  gui.add(param, "axes").name("座標軸");

  // 座標軸の設定
  const axes = new THREE.AxesHelper(18);
  scene.add(axes);

  // カメラの作成
  const camera = new THREE.PerspectiveCamera(
    50, window.innerWidth/window.innerHeight, 0.1, 1000);
  camera.position.set(0, 2, 5);

  // レンダラの設定
  const renderer = new THREE.WebGLRenderer();
  renderer.shadowMap.enabled = true;
  renderer.setSize(window.innerWidth, innerHeight);
  document.getElementById("output").appendChild(renderer.domElement);
  
  //-------------------------world設定--------------------------------

  // 方向性ライト（影をキャストする光源）
  const directionalLight = new THREE.DirectionalLight(0xffffff, 3);
  directionalLight.position.set(5, 10, 7.5);
  directionalLight.castShadow = true; // 影をキャストする設定
  directionalLight.shadow.mapSize.width = 1024;  // 影の解像度
  directionalLight.shadow.mapSize.height = 1024;
  scene.add(directionalLight);


  //地面
  const geometry = new THREE.PlaneGeometry(10, 100);
  const material = new THREE.MeshStandardMaterial({ color: 0x808080 });
  const ground = new THREE.Mesh(geometry, material);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true; // 地面が影を受け取る
  scene.add(ground);
  
  //空
  const sky = textureLoader.load('sky_picture.jpg');
  scene.background = sky;

  //-----------------------------------------------------------------

  //------------------------キャラクター関連----------------------------
  //キャラクター関数
  let player = null;      // キャラクター
  let mixer = null;       // キャラクターアニメーション
  let isJumping = false;  // ジャンプしているか
  let jumpVelocity = 0;   // ジャンプ速度
  let isFalling = false;  // 落ちてるかどうか
  let moveLeft = false;   // 左に移動
  let moveRight = false;  // 右に移動
  let jumpAction = null;  // ジャンプアニメーション
  let runAction = null;   // ランアニメーション
  let dfltAction = null;  // デフォルトアクション
  let gameOver = false;   // ゲームオーバーかどうか

  const raycaster = new THREE.Raycaster();
  const downVector = new THREE.Vector3(0, -0.01, 0);
  const moveSpeed = 0.08; // 移動速度
  const gravity = -0.028; // 重力

  let animationId;
  const clock = new THREE.Clock();

  // FBXモデルの読み込み
  const Fbxloader = new FBXLoader();
  Fbxloader.load(
      'run_jump.fbx',
      (fbx) => {
          fbx.scale.set(0.01, 0.01, 0.01); // スケール調整
          fbx.position.set(0, 0, 0);       // 初期位置を設定
          fbx.rotation.y = Math.PI;        // 角度調整
          scene.add(fbx);
          player = fbx;

          // カメラを三人称視点に設定
          camera.position.set(player.position.x, player.position.y + 2, player.position.z + 5);
          camera.lookAt(player.position);

          // アニメーション設定
          mixer = new THREE.AnimationMixer(fbx);
          runAction = mixer.clipAction(fbx.animations[0]);  // runアニメーション
          jumpAction = mixer.clipAction(fbx.animations[1]); // jumpアニメーション
          runAction.play();         // 初期状態をrunにする。
          dfltAction = runAction;

          // プレイヤーに影をキャストさせる(forEachではできない？模様)
          fbx.traverse((child) => {
              if (child.isMesh) {
                  child.castShadow = true;    // 影をキャスト
                  child.receiveShadow = true; // 影を受け取る
              }
          });
      },
  );

  //ジャンプ
  document.addEventListener('keydown', (event) => {
    if (event.code === 'Space' && !isJumping && !isFalling) {
      isJumping = true;
      jumpVelocity = 0.45;
      playAnimation(jumpAction);
    }
  });
  function playAnimation(action) {
    if(dfltAction === action){
      return;
    }
    if (dfltAction !== action) {
      dfltAction.fadeOut(0.2);
    }
    action.reset().fadeIn(0.2).play();
    dfltAction = action;
  }

  //左右移動
  document.addEventListener('keydown', (event) => {
      if (event.code === 'KeyA') {
          moveLeft = true;
          player.rotation.y = -2.3;
      } else if (event.code === 'KeyD') {
          moveRight = true;
          player.rotation.y = 2.3;
      }
  });
  document.addEventListener('keyup', (event) => {
      if (event.code === 'KeyA') {
          moveLeft = false;
          player.rotation.y = Math.PI;
      } else if (event.code === 'KeyD') {
          moveRight = false;
          player.rotation.y = Math.PI;
      }
  });


  // キャラクターの更新

  function updatePlayer() {

    if (moveLeft && player.position.x > -7) { // 左の制限
        player.position.x -= moveSpeed;
    }
    if (moveRight && player.position.x < 7) { // 右の制限
        player.position.x += moveSpeed;
    }

    // 落下処理------

    // Raycaster をキャラクターの現在位置に配置
    const playerPosition = new THREE.Vector3(
      player.position.x,
      player.position.y + 0.5,
      player.position.z
    );
    raycaster.set(playerPosition, downVector);

    // 地面との交差を取得
    const intersects = raycaster.intersectObject(ground);

    // 地面が見つかった場合(デバック用)
    //console.log(intersects.length===0);
    

    // ジャンプ中の処理
    if (isJumping) {
      player.position.y += jumpVelocity;
      jumpVelocity += gravity;
      
      if(intersects.length>0 && player.position.y<=0){
        player.position.y = 0;
        jumpVelocity = 0;
        isJumping = false;
        playAnimation(runAction);
      }
      
    }
    else if (intersects.length===0) {
      isFalling = true;
    }
    else{
      isFalling = false;
    }
    
    if(isFalling){
      player.position.y += jumpVelocity;
      jumpVelocity += gravity/2;
    }

    // 落下処理
    if (player.position.y < -5) {
      triggerGameOver();
      jumpVelocity = 0;
      isJumping = false;
      playAnimation(runAction);
      console.log('game over');
    }

    // カメラの追従
    camera.position.x = player.position.x;
    camera.position.y = player.position.y + 2;
    camera.position.z = player.position.z + 7.5;
    camera.lookAt(player.position);
    
    
  }

  //---------------------------------------------------------------------

  //----------------------------障害物の作成-------------------------------

  //障害物

  let objectsMax = 0;
  let objectInt = null; //clearIntercalを呼ぶための変数
  const objects = new THREE.Group();
  scene.add(objects);
  function createObject(){
    const objectGeometry = new THREE.BoxGeometry(2,1,0.5);
    const objectMaterial = new THREE.MeshStandardMaterial({color: 0xc71585});
    const object = new THREE.Mesh(objectGeometry, objectMaterial);
    if (Math.random() < 0.5) {
      object.position.set(Math.random() * -5, -0.5, -20); // 左側
    } else {
      object.position.set(Math.random() * 5, -0.5, -20);  // 右側
    }

    object.castShadow = true;
    object.receiveShadow = false;
    objects.add(object);
    objectsMax+=1;
    if(objectsMax===15){carcome = true;
      carInt = setInterval(() => {

        if (carcome) {
          carcome2 = true;
        }
      }, 2000);
      
    }
    //console.log('make');
  }


  function startCreate() {
    if (!objectInt) {
      objectInt = setInterval(() => {
        if (objects.children.length <= 5 && !gameOver && !carcome) {
          createObject();
        }
      }, 1000); // 1秒ごとに生成
    }
  }
  
  function stopCreate() {
    if (objectInt) {
      clearInterval(objectInt);
      objectInt = null; // 変数をリセット
    }
  }
  

  //障害物の移動
  function updateObject(){
    objects.children.forEach(object => {
      object.position.z += 0.2;
      if(object.position.y <= 0.4) {
        object.position.y += 0.1;
      }
      if(object.position.z > 4) {
        scene.remove(object);
        objects.remove(object);
      }
    });
    
  }

  //障害物の当たり判定
  function hitObject() {
    objects.children.forEach((object) => {
      const distance = player.position.distanceTo(object.position);
      if(distance < 1) {
        gameOver = true;
        objects.remove(object);
        triggerGameOver();
      }
    })
    
  }

  //car追加
  let carcome = false;
  let carcome2 = false;
  let car = null;
  let carInt = null;

  Fbxloader.load(
    'car.fbx',
    (fbx) => {
      fbx.scale.set(0.01, 0.01, 0.01); // スケール調整
      if (Math.random() < 0.5) {
        fbx.position.set(Math.random() * -5, -0.5, -30); // 左側
      } else {
        fbx.position.set(Math.random() * 5, -0.5, -30);  // 右側
      }
            // 初期位置を設定
      scene.add(fbx);
      fbx.visible = false;
      car = fbx;
      fbx.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;    // 影をキャスト
            child.receiveShadow = true; // 影を受け取る
        }
      });
    }
  );

  function carAction(){
    car.visible = true;
    car.position.z += 0.5;
    if(car.position.y <= 0) {
      car.position.y += 0.1;
    }
    if(car.position.z > 4) {
      car.visible = false;
      objectsMax = 0;
      clearInterval(carInt);
      carcome = false;
      carcome2 = false;
      car.position.set(Math.random()*4-2, -0.5,-30);
    }
    car.traverse((car) => {
      const cardistance = player.position.distanceTo(car.position);
      if(cardistance < 1.2) {
        gameOver = true;
        car.visible = false;
        triggerGameOver();
      }
    });
    console.log('car');
  }

  //---------------------------------------------------------------------


  // ゲームオーバー処理
  function triggerGameOver() {
    cancelAnimationFrame(animationId); // アニメーションを停止
    document.getElementById('gameOverScreen').style.display = 'flex'; // ゲームオーバー画面表示
    isFalling = false;
    stopCreate();
    resetGame();
  }

  //リセット
  function resetGame() {
    isJumping = false;
    jumpVelocity = 0;
    isFalling = false;
    moveLeft = false;
    moveRight = false;
    playAnimation(runAction);

    // オブジェクトグループをクリア
    objects.children.forEach((object) => {
      scene.remove(object); // シーンから削除
    });
    objects.clear();
    objectsMax = 0;
    car.visible = false;
    car.position.set(Math.random()*4-2, -0.5,-30);
    carcome = false;
    carcome2 = false;
  }


  // 描画処理

  // 描画関数
  function render() {
    // 座標軸の表示
    axes.visible = param.axes;
    
    // 次のフレームでの描画要請
    animationId = requestAnimationFrame(render);

    //キャラクターアニメーションのループ
    if (mixer) {
      const delta = clock.getDelta();
      mixer.update(delta);
    }

    updatePlayer();
    updateObject();
    hitObject();
    if(carcome2) {
      carAction();
    }


    // 描画
    renderer.render(scene, camera);
  }

}

init();
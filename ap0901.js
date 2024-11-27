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
  // HTML要素を取得
  const titleScreen = document.getElementById('titleScreen');
  const startButton = document.getElementById('startButton');
  const gameOverScreen = document.getElementById('gameOverScreen');
  const menuButton = document.getElementById('menuButton');
  gameOverScreen.style.display = 'none';

  // スタートボタンのクリックイベント
  startButton.addEventListener('click', () => {
    titleScreen.style.display = 'none'; // タイトル画面を非表示
    render(); // ゲーム開始
  });

  //ゲームオーバー: メニューボタンのクリックイベント
  menuButton.addEventListener('click', () => {
    gameOverScreen.style.display = 'none';
    player.position.set(0, 0, 0); // 初期位置
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
  
  //キャラクター関数
  let player = null;      // キャラクター
  let mixer = null;       // キャラクターアニメーション
  let isJumping = false;  // ジャンプしているか
  let jumpVelocity = 0;   // ジャンプ速度
  let isFalling = false;  // 落ちてるかどうか
  const moveSpeed = 0.08; // 移動速度
  let moveLeft = false;   // 左に移動
  let moveRight = false;  // 右に移動
  let jumpAction = null;  // ジャンプアニメーション
  let runAction = null;   // ランアニメーション
  let dfltAction = null; // デフォルトアクション

  const gravity = -0.012; // 重力

  let animationId;
  const clock = new THREE.Clock();

  // FBXモデルの読み込み
  const loader = new FBXLoader();
  loader.load(
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
    if (event.code === 'Space' && !isJumping) {
      isJumping = true;
      jumpVelocity = 0.28;
      playAnimation(jumpAction);
    }
  });
  function playAnimation(action) {
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

    // 地面の端を超えた場合に落下を開始
    if (player.position.x <= -5 || player.position.x >= 5 ) {
        isFalling = true; // 落下状態に移行
    }

    // 落下処理
    if (isFalling) {
        player.position.y += gravity * 4; // 重力を適用

        // 地面より下に落ちた場合はゲームオーバー
        if (player.position.y < -5) { // 落下しきったらゲームオーバー
            triggerGameOver();        // ゲームオーバー処理を呼び出し
        }
    }

    if (isJumping) {
      player.position.y += jumpVelocity;
      jumpVelocity += gravity;

      if (player.position.y <= 0) {
        player.position.y = 0;
        isJumping = false;
        jumpVelocity = 0;
        playAnimation(runAction);
      }
    }

    camera.position.x = player.position.x; // X座標を同期
    camera.position.y = player.position.y + 2; // 少し上
    camera.position.z = player.position.z + 7.5; // 後ろに配置
    camera.lookAt(player.position); // キャラクターを注視
    
  }





  // ゲームオーバー処理
  function triggerGameOver() {
    cancelAnimationFrame(animationId); // アニメーションを停止
    document.getElementById('gameOverScreen').style.display = 'flex'; // ゲームオーバー画面表示
    isFalling = false;
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


    // 描画
    renderer.render(scene, camera);
  }

}

init();
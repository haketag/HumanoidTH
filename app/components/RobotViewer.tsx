"use client";

import { useEffect, useRef, useState } from "react";
import styles from "../home.module.css";
import {
  ACESFilmicToneMapping,
  AmbientLight,
  AnimationMixer,
  Box3,
  Clock,
  Color,
  DirectionalLight,
  Group,
  MathUtils,
  Object3D,
  PerspectiveCamera,
  PMREMGenerator,
  Quaternion,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export default function RobotViewer({ lang }: { lang: "en" | "th" }) {
  const thai = lang === "th";
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">("loading");
  const frameRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const scene = new Scene();
    scene.background = null;

    const camera = new PerspectiveCamera(26, 1, 0.01, 100);
    camera.position.set(0, 0.45, 4.75);
    camera.lookAt(0, 0.32, 0);

    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ alpha: true, antialias: true });
    } catch {
      setStatus("unavailable");
      return;
    }
    renderer.setClearColor(new Color(0xffffff), 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    renderer.domElement.style.cursor = "grab";
    renderer.domElement.setAttribute("aria-hidden", "true");
    frame.appendChild(renderer.domElement);

    const room = new RoomEnvironment();
    const reflections = new PMREMGenerator(renderer);
    const environment = reflections.fromScene(room, 0.04);
    scene.environment = environment.texture;
    scene.environmentIntensity = 0.8;
    room.dispose();
    reflections.dispose();

    const ambient = new AmbientLight(0xffffff, 1.4);
    scene.add(ambient);

    const keyLight = new DirectionalLight(0xffffff, 2.7);
    keyLight.position.set(2.8, 4, 4);
    scene.add(keyLight);

    const fillLight = new DirectionalLight(0xffffff, 1.5);
    fillLight.position.set(-3, 2, 2.5);
    scene.add(fillLight);

    const rimLight = new DirectionalLight(0xffffff, 2.1);
    rimLight.position.set(0, 3.2, -3);
    scene.add(rimLight);

    const robotRoot = new Group();
    const baseRootY = -0.36;
    robotRoot.position.y = baseRootY;
    scene.add(robotRoot);

    const pointer = new Vector2(0, 0);
    const targetHead = new Vector2(0, 0);
    const currentHead = new Vector2(0, 0);
    let head: Object3D | undefined;
    const headRest = new Quaternion();
    let mixer: AnimationMixer | undefined;
    let lastTime = 0;

    let disposed = false;
    let dragging = false;
    let interactionEnergy = 0;
    let lastClientX = 0;
    let targetRootYaw = 0;
    let currentRootYaw = 0;
    let animationFrame = 0;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const resize = () => {
      const width = frame.clientWidth || 1;
      const height = frame.clientHeight || 1;
      camera.aspect = width / height;
      camera.zoom = Math.min(1, camera.aspect / 0.9);
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(frame);
    resize();

    const fitModelToStage = (model: Object3D) => {
      const box = new Box3().setFromObject(model);
      const size = new Vector3();
      const center = new Vector3();
      box.getSize(size);
      box.getCenter(center);

      const scale = size.y > 0 ? 3 / size.y : 1;
      model.scale.setScalar(scale);

      const scaledCenter = center.multiplyScalar(scale);
      model.position.set(-scaledCenter.x, -scaledCenter.y, -scaledCenter.z);
    };

    const loader = new GLTFLoader();
    loader.load("/silver-sentinel-v5.glb", (gltf) => {
      if (disposed) return;

      const model = gltf.scene;
      model.traverse((child) => {
        child.frustumCulled = false;
      });

      fitModelToStage(model);
      robotRoot.add(model);
      head = model.getObjectByName("Head");
      if (head) headRest.copy(head.quaternion);
      const presentation = gltf.animations.find((clip) => clip.name === "Subtle presentation");
      if (presentation) {
        mixer = new AnimationMixer(model);
        mixer.clipAction(presentation).play();
      }
      setStatus("ready");
    }, undefined, () => {
      if (!disposed) setStatus("unavailable");
    });

    const updatePointerTarget = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const dx = event.clientX - centerX;
      const dy = event.clientY - centerY;

      const x = MathUtils.clamp(dx / (window.innerWidth / 2), -1, 1);
      const y = MathUtils.clamp(dy / (window.innerHeight / 2), -1, 1);

      pointer.set(x, y);
      targetHead.set(pointer.x * 0.45, pointer.y * 0.32);
      interactionEnergy = Math.max(interactionEnergy, 0.65);
    };

    const onPointerDown = (event: PointerEvent) => {
      dragging = true;
      interactionEnergy = 1;
      lastClientX = event.clientX;
      renderer.domElement.style.cursor = "grabbing";
      renderer.domElement.setPointerCapture(event.pointerId);
      updatePointerTarget(event);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (reducedMotion.matches && !dragging) return;
      updatePointerTarget(event);

      if (!dragging) return;
      const deltaX = event.clientX - lastClientX;
      lastClientX = event.clientX;
      targetRootYaw += deltaX * 0.008;
      interactionEnergy = 1;
    };

    const onPointerUp = (event: PointerEvent) => {
      dragging = false;
      renderer.domElement.style.cursor = "grab";
      if (renderer.domElement.hasPointerCapture(event.pointerId)) {
        renderer.domElement.releasePointerCapture(event.pointerId);
      }
    };

    const onPointerLeave = () => {
      targetHead.set(0, 0);
      dragging = false;
      interactionEnergy = 0;
      renderer.domElement.style.cursor = "grab";
    };

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    document.addEventListener("pointerleave", onPointerLeave);

    const clock = new Clock();

    const animate = () => {
      const clockTime = clock.getElapsedTime();
      const deltaTime = lastTime === 0 ? 0.016 : clockTime - lastTime;
      lastTime = clockTime;
      const elapsed = reducedMotion.matches ? 0 : clockTime;

      interactionEnergy = MathUtils.lerp(interactionEnergy, dragging ? 1 : 0, dragging ? 0.08 : 0.018);
      const idleEnergy = 1 - interactionEnergy;
      const idleScan = new Vector2(
        Math.sin(elapsed * 0.34) * 0.16 + Math.sin(elapsed * 0.13) * 0.08,
        Math.sin(elapsed * 0.27 + 1.2) * 0.07
      );
      const aliveTargetHead = new Vector2(
        targetHead.x * (0.9 + interactionEnergy * 0.35) + idleScan.x * idleEnergy,
        targetHead.y * (0.9 + interactionEnergy * 0.28) + idleScan.y * idleEnergy
      );
      const breath = Math.sin(elapsed * 1.55) * 0.018;
      const attentiveLean = MathUtils.clamp(currentHead.x, -0.35, 0.35);

      currentRootYaw += (targetRootYaw - currentRootYaw) * 0.12;
      currentHead.lerp(aliveTargetHead, 0.13 + interactionEnergy * 0.05);

      robotRoot.rotation.y = currentRootYaw;
      robotRoot.rotation.x = Math.sin(elapsed * 0.42) * 0.012 * idleEnergy - Math.abs(currentHead.y) * 0.035 * interactionEnergy;
      robotRoot.rotation.z = Math.sin(elapsed * 0.5 + 0.8) * 0.012 * idleEnergy - attentiveLean * 0.045 * interactionEnergy;
      robotRoot.position.y = baseRootY + breath + Math.sin(elapsed * 0.72) * 0.012 * idleEnergy;
      const breathScale = 1 + Math.sin(elapsed * 1.55 + 0.4) * 0.004;
      robotRoot.scale.setScalar(breathScale + interactionEnergy * 0.006);

      if (head) head.quaternion.copy(headRest);
      if (reducedMotion.matches) mixer?.setTime(0);
      else mixer?.update(deltaTime);

      if (head && !reducedMotion.matches) {
        head.rotation.x += currentHead.y;
        head.rotation.y += currentHead.x;
      }

      renderer.render(scene, camera);
      animationFrame = window.requestAnimationFrame(animate);
    };

    const visibility = new IntersectionObserver(([entry]) => {
      window.cancelAnimationFrame(animationFrame);
      lastTime = 0;
      if (entry.isIntersecting) animate();
    });
    visibility.observe(frame);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      visibility.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      document.removeEventListener("pointerleave", onPointerLeave);
      mixer?.stopAllAction();
      environment.dispose();
      renderer.dispose();
      frame.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div ref={frameRef} className="robot-viewer-frame" data-model-state={status}>
      {status === "ready" ? (
        <span role="img" aria-label={thai ? "โมเดลหุ่นยนต์ฮิวแมนนอยด์ 3 มิติ" : "3D humanoid robot model"} />
      ) : (
        <p className={styles.viewerMessage} role="status">
          {status === "loading"
            ? (thai ? "กำลังโหลดโมเดล 3 มิติ…" : "Loading 3D model…")
            : (thai ? "ไม่สามารถแสดงโมเดล 3 มิติได้" : "The 3D model could not be displayed.")}
        </p>
      )}
    </div>
  );
}

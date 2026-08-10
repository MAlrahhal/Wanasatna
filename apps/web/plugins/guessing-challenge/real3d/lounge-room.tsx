'use client';

/**
 * Cozy Fall Guys–inspired lounge: purple walls, wood floor, rug, neon W, props.
 * Lightweight primitives only — no GLTF.
 */
export function LoungeRoom() {
  return (
    <group>
      {/* Wood floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -0.6]} receiveShadow>
        <planeGeometry args={[12, 12]} />
        <meshStandardMaterial color="#8b5a2b" roughness={0.85} metalness={0.02} />
      </mesh>
      {/* Floor grain strips */}
      {([-3, -1.5, 0, 1.5, 3] as const).map((x) => (
        <mesh key={x} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.005, -0.6]}>
          <planeGeometry args={[0.04, 11]} />
          <meshStandardMaterial color="#6b4423" roughness={0.9} />
        </mesh>
      ))}

      {/* Circular rug — stacked discs */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, -1.1]} receiveShadow>
        <circleGeometry args={[1.55, 48]} />
        <meshStandardMaterial color="#4c1d95" roughness={0.9} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, -1.1]}>
        <ringGeometry args={[1.15, 1.45, 48]} />
        <meshStandardMaterial color="#f59e0b" roughness={0.85} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, -1.1]}>
        <circleGeometry args={[0.55, 32]} />
        <meshStandardMaterial color="#7c3aed" roughness={0.85} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.035, -1.1]}>
        <circleGeometry args={[0.22, 24]} />
        <meshStandardMaterial color="#fbbf24" roughness={0.8} />
      </mesh>

      {/* Back wall — purple */}
      <mesh position={[0, 1.7, -4.4]} receiveShadow>
        <boxGeometry args={[10, 3.6, 0.18]} />
        <meshStandardMaterial color="#5b21b6" roughness={0.75} />
      </mesh>
      {/* Side walls */}
      <mesh position={[-4.6, 1.7, -1.2]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[7.2, 3.6, 0.16]} />
        <meshStandardMaterial color="#4c1d95" roughness={0.8} />
      </mesh>
      <mesh position={[4.6, 1.7, -1.2]} rotation={[0, -Math.PI / 2, 0]}>
        <boxGeometry args={[7.2, 3.6, 0.16]} />
        <meshStandardMaterial color="#4c1d95" roughness={0.8} />
      </mesh>
      {/* Ceiling strip */}
      <mesh position={[0, 3.45, -1.5]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[10, 7]} />
        <meshStandardMaterial color="#2e1065" roughness={1} />
      </mesh>

      {/* Neon W — far upper-left corner (not above opponent head / name) */}
      <NeonW position={[-3.25, 2.95, -4.28]} />

      {/* Left shelf + props */}
      <group position={[-3.4, 0.9, -3.6]}>
        <mesh castShadow>
          <boxGeometry args={[1.4, 0.08, 0.45]} />
          <meshStandardMaterial color="#78350f" />
        </mesh>
        <mesh position={[-0.35, 0.28, 0]} castShadow>
          <boxGeometry args={[0.28, 0.45, 0.28]} />
          <meshStandardMaterial color="#f59e0b" />
        </mesh>
        <mesh position={[0.05, 0.22, 0.02]} castShadow>
          <boxGeometry args={[0.22, 0.35, 0.22]} />
          <meshStandardMaterial color="#38bdf8" />
        </mesh>
        {/* Trophy */}
        <mesh position={[0.45, 0.35, 0]} castShadow>
          <cylinderGeometry args={[0.08, 0.1, 0.2, 10]} />
          <meshStandardMaterial color="#fbbf24" metalness={0.6} roughness={0.3} />
        </mesh>
        <mesh position={[0.45, 0.5, 0]}>
          <sphereGeometry args={[0.1, 10, 8]} />
          <meshStandardMaterial color="#fde68a" metalness={0.5} roughness={0.35} />
        </mesh>
      </group>

      {/* Right shelf + plant */}
      <group position={[3.4, 0.9, -3.6]}>
        <mesh castShadow>
          <boxGeometry args={[1.4, 0.08, 0.45]} />
          <meshStandardMaterial color="#78350f" />
        </mesh>
        <mesh position={[-0.3, 0.2, 0]} castShadow>
          <boxGeometry args={[0.25, 0.32, 0.25]} />
          <meshStandardMaterial color="#fb7185" />
        </mesh>
        {/* Plant pot */}
        <mesh position={[0.35, 0.12, 0]} castShadow>
          <cylinderGeometry args={[0.12, 0.1, 0.18, 10]} />
          <meshStandardMaterial color="#92400e" />
        </mesh>
        <mesh position={[0.35, 0.32, 0]}>
          <sphereGeometry args={[0.18, 10, 8]} />
          <meshStandardMaterial color="#22c55e" roughness={0.8} />
        </mesh>
        <mesh position={[0.22, 0.4, 0.05]}>
          <sphereGeometry args={[0.1, 8, 6]} />
          <meshStandardMaterial color="#16a34a" />
        </mesh>
      </group>

      {/* Sofa / beanbag left */}
      <group position={[-2.8, 0.28, -0.2]} rotation={[0, 0.55, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.55, 14, 10]} />
          <meshStandardMaterial color="#7c3aed" roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.15, -0.25]} scale={[1.05, 0.7, 0.55]} castShadow>
          <sphereGeometry args={[0.45, 12, 8]} />
          <meshStandardMaterial color="#6d28d9" roughness={0.9} />
        </mesh>
      </group>

      {/* Sofa / beanbag right */}
      <group position={[2.8, 0.28, -0.2]} rotation={[0, -0.55, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.55, 14, 10]} />
          <meshStandardMaterial color="#ea580c" roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.15, -0.25]} scale={[1.05, 0.7, 0.55]} castShadow>
          <sphereGeometry args={[0.45, 12, 8]} />
          <meshStandardMaterial color="#c2410c" roughness={0.9} />
        </mesh>
      </group>

      {/* Warm lamps */}
      <Lamp position={[-3.2, 0, -2.2]} />
      <Lamp position={[3.2, 0, -2.2]} />
    </group>
  );
}

function NeonW({ position }: { position: [number, number, number] }) {
  const bar = (props: {
    pos: [number, number, number];
    rot?: [number, number, number];
    size: [number, number, number];
  }) => (
    <mesh position={props.pos} rotation={props.rot ?? [0, 0, 0]}>
      <boxGeometry args={props.size} />
      <meshStandardMaterial
        color="#f472b6"
        emissive="#ec4899"
        emissiveIntensity={1.4}
        roughness={0.35}
      />
    </mesh>
  );

  return (
    <group position={position}>
      {bar({ pos: [-0.42, 0, 0], rot: [0, 0, 0.35], size: [0.12, 0.85, 0.08] })}
      {bar({ pos: [-0.14, -0.12, 0], rot: [0, 0, -0.45], size: [0.12, 0.7, 0.08] })}
      {bar({ pos: [0.14, -0.12, 0], rot: [0, 0, 0.45], size: [0.12, 0.7, 0.08] })}
      {bar({ pos: [0.42, 0, 0], rot: [0, 0, -0.35], size: [0.12, 0.85, 0.08] })}
      <pointLight intensity={0.55} distance={5} color="#f472b6" position={[0, 0, 0.4]} />
    </group>
  );
}

function Lamp({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.55, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.07, 1.1, 8]} />
        <meshStandardMaterial color="#44403c" />
      </mesh>
      <mesh position={[0, 1.2, 0]}>
        <coneGeometry args={[0.28, 0.32, 12]} />
        <meshStandardMaterial
          color="#fef3c7"
          emissive="#fbbf24"
          emissiveIntensity={0.55}
          transparent
          opacity={0.9}
        />
      </mesh>
      <pointLight intensity={0.7} distance={4.5} color="#fdba74" position={[0, 1.05, 0]} />
    </group>
  );
}

/** Orange armchair for a seated bean character. */
export function OrangeArmchair() {
  return (
    <group>
      {/* Seat cushion */}
      <mesh position={[0, 0.38, 0.05]} castShadow receiveShadow>
        <boxGeometry args={[0.78, 0.16, 0.72]} />
        <meshStandardMaterial color="#ea580c" roughness={0.7} />
      </mesh>
      {/* Soft seat top */}
      <mesh position={[0, 0.5, 0.08]} scale={[1, 0.45, 0.95]} castShadow>
        <sphereGeometry args={[0.36, 14, 10]} />
        <meshStandardMaterial color="#f97316" roughness={0.75} />
      </mesh>
      {/* Back */}
      <mesh position={[0, 0.85, -0.28]} castShadow>
        <boxGeometry args={[0.78, 0.85, 0.14]} />
        <meshStandardMaterial color="#c2410c" roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.05, -0.22]} scale={[1.05, 0.7, 0.5]} castShadow>
        <sphereGeometry args={[0.34, 12, 8]} />
        <meshStandardMaterial color="#ea580c" roughness={0.75} />
      </mesh>
      {/* Arms */}
      <mesh position={[-0.42, 0.62, 0.05]} castShadow>
        <boxGeometry args={[0.14, 0.28, 0.65]} />
        <meshStandardMaterial color="#9a3412" />
      </mesh>
      <mesh position={[0.42, 0.62, 0.05]} castShadow>
        <boxGeometry args={[0.14, 0.28, 0.65]} />
        <meshStandardMaterial color="#9a3412" />
      </mesh>
      {/* Legs */}
      {(
        [
          [-0.3, 0.14, -0.28],
          [0.3, 0.14, -0.28],
          [-0.3, 0.14, 0.28],
          [0.3, 0.14, 0.28],
        ] as const
      ).map((pos, i) => (
        <mesh key={i} position={pos}>
          <cylinderGeometry args={[0.04, 0.045, 0.28, 8]} />
          <meshStandardMaterial color="#44403c" />
        </mesh>
      ))}
    </group>
  );
}

import { useEffect, useRef } from "react";
import { useLobbyStore } from "../../store/useLobbyStore";

export default function WebRTCAudioManager({
  remoteAudioStream: propRemoteAudioStream,
  remoteAudioStreams: propRemoteAudioStreams,
}) {
  const storeStream = useLobbyStore((state) => state.remoteAudioStream);
  const storeStreams = useLobbyStore((state) => state.remoteAudioStreams);

  const remoteAudioStream =
    propRemoteAudioStream !== undefined ? propRemoteAudioStream : storeStream;
  const remoteAudioStreams =
    propRemoteAudioStreams !== undefined ? propRemoteAudioStreams : storeStreams;

  // WebRTC Audio reference
  const remoteAudioRef = useRef(null);

  // Sync WebRTC remote audio stream to element
  useEffect(() => {
    if (remoteAudioRef.current) {
      if (remoteAudioStream) {
        console.log("[Voice UI] Binding remote audio stream to audio element");
        remoteAudioRef.current.srcObject = remoteAudioStream;
        remoteAudioRef.current.play().catch((err) => {
          console.warn("[Voice UI] Autoplay blocked or failed:", err);
        });
      } else {
        remoteAudioRef.current.srcObject = null;
      }
    }
  }, [remoteAudioStream]);

  return (
    <>
      {/* Hidden WebRTC Remote Audio Player */}
      {/* Hidden WebRTC Remote Audio Players for Multi-Peer Mesh */}
      <audio
        ref={remoteAudioRef}
        autoPlay
        playsInline
        controls={false}
        style={{
          position: "absolute",
          opacity: 0,
          width: "1px",
          height: "1px",
          pointerEvents: "none",
        }}
      />
      {Object.entries(remoteAudioStreams || {}).map(([peerId, stream]) => (
        <audio
          key={peerId}
          autoPlay
          playsInline
          controls={false}
          style={{
            position: "absolute",
            opacity: 0,
            width: "1px",
            height: "1px",
            pointerEvents: "none",
          }}
          ref={(audioEl) => {
            if (audioEl && stream && audioEl.srcObject !== stream) {
              audioEl.srcObject = stream;
            }
          }}
        />
      ))}
    </>
  );
}

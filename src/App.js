import React, {Fragment, useEffect, useRef} from "react";
import io from "socket.io-client";

function App({serverURI}) {
  const userVideo = useRef();
  const partnerVideo = useRef();
  const peerRef = useRef();
  const socketRef = useRef();
  const otherUser = useRef();
  const userStream = useRef();
  const roomId = "test";
  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ audio: true, video: true }).then(stream => {
      userVideo.current.srcObject = stream;
      userStream.current = stream;

      socketRef.current = io.connect(process.env.REACT_APP_SERVER_URI);
      socketRef.current = io.connect(serverURI);
      socketRef.current.emit("join room", roomId);

      socketRef.current.on('other user', userID => {
        callUser(userID);
        otherUser.current = userID;
      });
      socketRef.current.on("user joined", userID => {
        otherUser.current = userID;
      });
      socketRef.current.on("offer", handleRecieveCall);
      socketRef.current.on("answer", handleAnswer);
      socketRef.current.on("ice-candidate", handleNewICECandidateMsg);
    });

    window.onbeforeunload = hangout;

    return () => {
      hangout();
    };
  }, []);

  function callUser(userID) {
    peerRef.current = createPeer(userID);
    userStream.current.getTracks().forEach(track => peerRef.current.addTrack(track, userStream.current));
  }

  function createPeer(userID) {
    const peer = new RTCPeerConnection({
      iceServers: [
        {
          urls: "stun:stun.stunprotocol.org"
        },
        {
          urls: 'turn:numb.viagenie.ca',
          credential: 'muazkh',
          username: 'webrtc@live.com'
        },
      ]
    });
    peer.onicecandidate = handleICECandidateEvent;
    peer.ontrack = handleTrackEvent;
    peer.onnegotiationneeded = () => handleNegotiationNeededEvent(userID);
    return peer;
  }
  function handleNegotiationNeededEvent(userID) {
    console.log("Negotiation");
    peerRef.current.createOffer().then(offer => {
      return peerRef.current.setLocalDescription(offer);
    }).then(() => {
      const payload = {
        target: userID,
        caller: socketRef.current.id,
        sdp: peerRef.current.localDescription
      };
      socketRef.current.emit("offer", payload);
    }).catch(e => console.log(e));
  }
  function handleRecieveCall(incoming) {
    peerRef.current = createPeer();
    peerRef.current.setRemoteDescription(incoming.sdp).then(() => {
      userStream.current.getTracks().forEach(track => peerRef.current.addTrack(track, userStream.current));
    }).then(() => {
      return peerRef.current.createAnswer();
    }).then(answer => {
      return peerRef.current.setLocalDescription(answer);
    }).then(() => {
      const payload = {
        target: incoming.caller,
        caller: socketRef.current.id,
        sdp: peerRef.current.localDescription
      }
      socketRef.current.emit("answer", payload);
    })
  }
  function handleAnswer(message) {
    peerRef.current.setRemoteDescription(message.sdp).catch(e => console.log(e));
  }

  function handleICECandidateEvent(e) {
    if (e.candidate) {
      const payload = {
        target: otherUser.current,
        candidate: e.candidate,
      }
      socketRef.current.emit("ice-candidate", payload);
    }
  }
  function handleNewICECandidateMsg(incoming) {
    const candidate = new RTCIceCandidate(incoming);
    peerRef.current.addIceCandidate(candidate)
      .catch(e => console.log(e));
  }
  function handleTrackEvent(e) {
    partnerVideo.current.srcObject = e.streams[0];
  }
  function hangout() {
    socketRef.current.emit("close", roomId);
    peerRef.current.close();
    socketRef.current.close();
  }

  function mute() {
    userStream.current.getAudioTracks().forEach(audio => audio.enabled = !audio.enabled);
  }

  function hide() {
    userStream.current.getVideoTracks().forEach(x => x.enabled = !x.enabled)
  }

  return (
    <Fragment>
      <div>
        <h1>Realtime communication with WebRTC</h1>
        <video id="localVideo" autoPlay playsInline ref={userVideo} muted />
        <video id="remoteVideo" autoPlay playsInline ref={partnerVideo}/>
      </div>
      <div>
        <button onClick={mute}>Mute</button>
        <button onClick={hide}>Show</button>
      </div>
    </Fragment>
  )
}

export default App;

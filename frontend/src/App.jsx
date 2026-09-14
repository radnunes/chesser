import { useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import { io } from "socket.io-client";

const socket = io("http://localhost:3001", {
  autoConnect: false,
  transports: ["websocket", "polling"],
});
const pieceMap = {
  w: { p: "♙", r: "♖", n: "♘", b: "♗", q: "♕", k: "♔" },
  b: { p: "♟", r: "♜", n: "♞", b: "♝", q: "♛", k: "♚" },
};
const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
const formatClock = (seconds) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
const variantOptions = [
  [
    "standard",
    "Standard chess",
    "The classic game: checkmate the opposing king.",
  ],
  [
    "chess960",
    "Chess960",
    "Randomize the back rank while keeping castling balanced.",
  ],
  [
    "king-of-the-hill",
    "King of the Hill",
    "Reach the center of the board with your king to win.",
  ],
  ["three-check", "Three-check", "Check the opposing king three times to win."],
  [
    "seirawan",
    "Seirawan chess",
    "Develop your army with two extra pieces held in reserve.",
  ],
];
const variantLabel = (value) => variantOptions.find(([key]) => key === value)?.[1] || 'Standard chess';

export default function App() {
  const [screen, setScreen] = useState("lobby");
  const [roomCode, setRoomCode] = useState("");
  const [playerColor, setPlayerColor] = useState(null);
  const [role, setRole] = useState(null);
  const [mode, setMode] = useState("player");
  const [rooms, setRooms] = useState([]);
  const [joinInput, setJoinInput] = useState("");
  const [fen, setFen] = useState(new Chess().fen());
  const [turn, setTurn] = useState("w");
  const [status, setStatus] = useState("Choose how you want to play.");
  const [players, setPlayers] = useState({ white: null, black: null });
  const [spectators, setSpectators] = useState(0);
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [draggedSquare, setDraggedSquare] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [setupColor, setSetupColor] = useState("random");
  const [setupMinutes, setSetupMinutes] = useState(5);
  const [setupIncrement, setSetupIncrement] = useState(0);
  const [setupVariant, setSetupVariant] = useState("standard");
  const [clocks, setClocks] = useState({ w: 300, b: 300 });
  const [config, setConfig] = useState({
    initialSeconds: 300,
    incrementSeconds: 0,
  });
  const [gameOver, setGameOver] = useState(false);
  const [drawOffer, setDrawOffer] = useState(null);
  const [result, setResult] = useState(null);
  const [rematchOffer, setRematchOffer] = useState(null);
  const socketRef = useRef(socket);
  const initialRoomJoinAttempted = useRef(false);
  const chess = useMemo(() => new Chess(fen), [fen]);
  const initialRoomCode = window.location.pathname
    .slice(1)
    .trim()
    .toUpperCase();

  useEffect(() => {
    const currentSocket = socketRef.current;
    currentSocket.connect();
    currentSocket.on("connect", () => {
      setIsConnected(true);
      currentSocket.emit("request-rooms");
      if (initialRoomCode && !initialRoomJoinAttempted.current) {
        initialRoomJoinAttempted.current = true;
        currentSocket.emit("join-room", {
          roomCode: initialRoomCode,
          role: "player",
        });
      }
    });
    currentSocket.on("disconnect", () => setIsConnected(false));
    currentSocket.on("connect_error", () =>
      setStatus("Server unavailable. Start the backend on port 3001."),
    );
    currentSocket.on("room-list", setRooms);
    currentSocket.on(
      "room-joined",
      ({ roomCode: activeRoom, color, role: activeRole = "player" }) => {
        setRoomCode(activeRoom);
        setPlayerColor(color);
        setRole(activeRole);
        setScreen("room");
        setSelectedSquare(null);
        window.history.pushState({}, "", `/${activeRoom}`);
      },
    );
    currentSocket.on(
      "room-state",
      ({
        roomCode: activeRoom,
        fen: nextFen,
        turn: nextTurn,
        status: nextStatus,
        players: nextPlayers,
        spectators: nextSpectators,
        mode: nextMode,
        clocks: nextClocks,
        config: nextConfig,
        gameOver: nextGameOver,
        drawOffer: nextDrawOffer,
        result: nextResult,
        rematchOffer: nextRematchOffer,
      }) => {
        const finalPosition = new Chess(nextFen);
        const resolvedResult = nextResult || (
          nextGameOver && finalPosition.isCheckmate()
            ? {
                type: "checkmate",
                winner: finalPosition.turn() === "w" ? "b" : "w",
                loser: finalPosition.turn(),
              }
            : null
        );
        setRoomCode(activeRoom);
        setFen(nextFen);
        setTurn(nextTurn);
        setPlayers(nextPlayers);
        setSpectators(nextSpectators || 0);
        setMode(nextMode || "player");
        setStatus(nextStatus);
        setClocks(nextClocks || { w: 300, b: 300 });
        setConfig(nextConfig || { initialSeconds: 300, incrementSeconds: 0 });
        setGameOver(Boolean(nextGameOver));
        setDrawOffer(nextDrawOffer || null);
        setResult(resolvedResult);
        setRematchOffer(nextRematchOffer || null);
      },
    );
    currentSocket.on("room-error", (message) => setStatus(message));
    const handlePopState = () => {
      const activeRoom = window.location.pathname.slice(1).trim().toUpperCase();
      if (!activeRoom) {
        setScreen("lobby");
        setRoomCode("");
        return;
      }

      currentSocket.emit("join-room", { roomCode: activeRoom, role: "player" });
    };
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      currentSocket.removeAllListeners();
      currentSocket.disconnect();
    };
  }, []);

  const boardSquares = useMemo(
    () =>
      Array.from({ length: 8 }, (_, row) => {
        const rank = 8 - row;
        return files.map((file, column) => ({
          square: `${file}${rank}`,
          isDark: (row + column) % 2 === 1,
          row,
          column,
        }));
      }).flat(),
    [],
  );
  const displayedSquares = useMemo(
    () => (playerColor === "b" ? [...boardSquares].reverse() : boardSquares),
    [boardSquares, playerColor],
  );
  const legalTargets = useMemo(() => {
    if (!selectedSquare) return [];
    try {
      return new Chess(fen)
        .moves({ square: selectedSquare, verbose: true })
        .map((move) => move.to);
    } catch {
      return [];
    }
  }, [fen, selectedSquare]);
  const openSetup = (selectedMode = mode) => {
    setMode(selectedMode);
    setSetupOpen(true);
  };
  const createRoom = () => {
    if (!isConnected) return;
    socketRef.current.emit("create-room", {
      mode,
      color: setupColor,
      variant: setupVariant,
      initialSeconds: Number(setupMinutes) * 60,
      incrementSeconds: Number(setupIncrement),
    });
    setSetupOpen(false);
  };
  const joinRoom = (code = joinInput, selectedRole = "player") => {
    const normalized = code.trim().toUpperCase();
    if (!normalized) {
      setStatus("Enter a room code first.");
      return;
    }
    socketRef.current.emit("join-room", {
      roomCode: normalized,
      role: selectedRole,
    });
  };
  const sendMove = (from, to) => {
    if (!roomCode || role !== "player" || !playerColor || turn !== playerColor)
      return;
    const candidate = new Chess(fen);
    try {
      if (!candidate.move({ from, to, promotion: "q" })) return;
    } catch {
      setStatus("That move is not legal.");
      return;
    }
    socketRef.current.emit("make-move", {
      roomCode,
      move: { from, to, promotion: "q" },
    });
    setSelectedSquare(null);
    setDraggedSquare(null);
  };
  const handleSquareClick = (square) => {
    if (role !== "player" || turn !== playerColor) return;
    const piece = chess.get(square);
    if (selectedSquare) {
      if (piece?.color === playerColor) {
        setSelectedSquare(square);
        setDraggedSquare(null);
        return;
      }
      sendMove(selectedSquare, square);
      return;
    }
    if (piece?.color === playerColor) setSelectedSquare(square);
  };
  const leaveRoom = () => {
    socketRef.current.disconnect();
    socketRef.current.connect();
    window.history.pushState({}, "", "/");
    setRoomCode("");
    setRole(null);
    setPlayerColor(null);
    setScreen("lobby");
    setStatus("Choose how you want to play.");
    setResult(null);
    setDrawOffer(null);
    setRematchOffer(null);
  };

  const sendGameAction = (action) => {
    if (role === "player" && roomCode && !gameOver)
      socketRef.current.emit(action, { roomCode });
  };
  const requestRematch = () => {
    if (role === "player" && roomCode && result) {
      socketRef.current.emit("rematch", { roomCode });
      setStatus("Sending rematch offer...");
    }
  };
  const respondToRematch = (accept) => {
    if (role === "player" && roomCode && rematchOffer && rematchOffer !== playerColor) {
      socketRef.current.emit("respond-rematch", { roomCode, accept });
    }
  };
  const respondToDraw = (accept) => {
    if (role === "player" && roomCode && drawOffer && drawOffer !== playerColor)
      socketRef.current.emit("respond-draw", { roomCode, accept });
  };
  const shareUrl = `${window.location.origin}/${roomCode}`;
  const copyShareUrl = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setStatus("Share link copied.");
  };
  const opponentColor = playerColor === "w" ? "b" : "w";
  const renderClock = (color) => {
    const isWhite = color === "w";
    const player = isWhite ? players.white : players.black;
    return (
      <div className={`clock-card ${color === playerColor ? "your-clock" : "opponent-clock"}`}>
        <span className={`clock-side ${isWhite ? "white-side" : "black-side"}`}>
          {isWhite ? "WHITE" : "BLACK"}
        </span>
        <span className="clock-name">
          {player?.name || (isWhite ? "White" : "Black")} {color === playerColor && "(you)"}
        </span>
        <strong className={turn === color ? "clock-active" : ""}>
          {formatClock(clocks[color])}
        </strong>
      </div>
    );
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" type="button" onClick={leaveRoom}>
          <span className="brand-mark">♞</span>
          <span>chesser</span>
        </button>
        <div className={`connection ${isConnected ? "online" : ""}`}>
          <span className="connection-dot" />{" "}
          {isConnected ? "Online" : "Offline"}
        </div>
      </header>
      {screen === "lobby" && (
        <section className="lobby-layout">
          <div className="intro-block">
            <p className="eyebrow">No account needed</p>
            <h1>
              Chess, shared
              <br />
              <em>in a moment.</em>
            </h1>
            <p className="intro-copy">
              Play a game with a friend or the computer.
            </p>
          </div>
          <div className="lobby-card">
            <div className="mode-tabs">
              <button
                className={mode === "player" ? "active" : ""}
                onClick={() => setMode("player")}
              >
                Vs player
              </button>
              <button
                className={mode === "bot" ? "active" : ""}
                onClick={() => setMode("bot")}
              >
                Vs computer
              </button>
            </div>
            <button className="hero-action" onClick={() => openSetup(mode)}>
              <span>
                <strong>
                  {mode === "player" ? "Create a room" : "Play the computer"}
                </strong>
                <small>
                  {mode === "player"
                    ? "Invite someone with a short code"
                    : "A quiet game, whenever you are ready"}
                </small>
              </span>
              <span className="arrow">↗</span>
            </button>
            <div className="join-form">
              <input
                value={joinInput}
                onChange={(event) => setJoinInput(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && joinRoom()}
                placeholder="Enter room code"
                maxLength={6}
              />
              <button onClick={() => joinRoom()}>Join room</button>
            </div>
            <div className="section-heading">
              <span>Open rooms</span>
              <button onClick={() => socketRef.current.emit("request-rooms")}>
                Refresh
              </button>
            </div>
            <div className="room-list">
              {rooms.length === 0 ? (
                <p className="empty-state">
                  No open rooms yet. Create the first one.
                </p>
              ) : (
                rooms.map((room) => (
                  <div className="room-row" key={room.roomCode}>
                    <div>
                      <strong>{room.roomCode}</strong>
                      <span>
                        {room.mode === "bot"
                          ? "Computer game"
                          : room.players.black
                            ? "In progress"
                            : "Waiting"}{" "}
                        · {variantLabel(room.variant)} · {room.spectators} watching
                      </span>
                    </div>
                    <div className="room-actions">
                      <button onClick={() => joinRoom(room.roomCode, "spectator")}>Watch</button>
                      <button onClick={() => joinRoom(room.roomCode, "player")}>Join</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      )}
      {setupOpen && (
        <div className="modal-backdrop" role="presentation">
          <section
            className="setup-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="setup-title"
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">New match</p>
                <h2 id="setup-title">Set up your game</h2>
              </div>
              <button
                className="modal-close"
                onClick={() => setSetupOpen(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="setup-group">
              <span className="setup-label">Play as</span>
              <div className="choice-row">
                {[
                  ["random", "Random"],
                  ["white", "White"],
                  ["black", "Black"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    className={
                      setupColor === value ? "choice active" : "choice"
                    }
                    onClick={() => setSetupColor(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="setup-group">
              <span className="setup-label">Chess mode</span>
              <select className="variant-select" value={setupVariant} onChange={(event) => setSetupVariant(event.target.value)}>
                {variantOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <p className="variant-description">{variantOptions.find(([value]) => value === setupVariant)?.[2]}</p>
            </div>
            <div className="setup-group">
              <span className="setup-label">Time control</span>
              <div className="control-row">
                <label>
                  Minutes
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={setupMinutes}
                    onChange={(event) => setSetupMinutes(event.target.value)}
                  />
                </label>
                <label>
                  Increment
                  <input
                    type="number"
                    min="0"
                    max="60"
                    value={setupIncrement}
                    onChange={(event) => setSetupIncrement(event.target.value)}
                  />
                </label>
                <span className="unit-label">+ seconds</span>
              </div>
            </div>
            <button className="confirm-button" onClick={createRoom}>
              {mode === "bot" ? "Start game" : "Create room"} <span>↗</span>
            </button>
          </section>
        </div>
      )}
      {screen === "room" && (
        <section className="room-layout">
          <div className="room-head">
            <div>
              <p className="eyebrow">Room {roomCode}</p>
              {(role === "spectator" ||
                ((!players.white || !players.black) && mode === "player")) && (
                <h1>
                  {role === "spectator"
                    ? "You are watching"
                    : "Waiting for a challenger"}
                </h1>
              )}
            </div>
            <button className="quiet-button" onClick={leaveRoom}>
              Leave room
            </button>
          </div>
          {role === "player" && (!players.white || !players.black) && mode === "player" ? (
            <div className="waiting-card">
              <div className="waiting-orb">♞</div>
              <h2>Share this room</h2>
              <p>Send this link to your friend:</p>
              <div className="share-link-row">
                <input value={shareUrl} readOnly aria-label="Room share URL" />
                <button onClick={copyShareUrl}>Copy link</button>
              </div>
              <strong className="room-code">{roomCode}</strong>
              <p className="muted">
                The board will unlock as soon as they arrive.
              </p>
            </div>
          ) : (
            <div className="game-layout">
              <div className="board-wrap">
                <div className="board-grid">
                  {displayedSquares.map(({ square, isDark, row, column }) => {
                    const piece = chess.get(square);
                    const selected = selectedSquare === square;
                    const legal = legalTargets.includes(square);
                    const checkedKing = chess.isCheck() && piece?.type === "k" && piece.color === chess.turn();
                    const isLeftEdge =
                      playerColor === "b" ? column === 7 : column === 0;
                    const isBottomEdge =
                      playerColor === "b" ? row === 0 : row === 7;
                    return (
                      <button
                        key={square}
                        type="button"
                        className={`square ${isDark ? "dark" : "light"} ${selected ? "selected" : ""} ${legal ? "legal" : ""} ${checkedKing ? "checked-king" : ""}`}
                        draggable={Boolean(
                          piece &&
                          piece.color === playerColor &&
                          role === "player",
                        )}
                        onDragStart={() => setDraggedSquare(square)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() =>
                          draggedSquare && sendMove(draggedSquare, square)
                        }
                        onClick={() => handleSquareClick(square)}
                      >
                        <span className="coordinate-label">
                          {isLeftEdge ? square[1] : ""}
                        </span>
                        <span className="file-label">
                          {isBottomEdge ? square[0] : ""}
                        </span>
                        {piece && (
                          <span
                            className={`piece-icon ${piece.color === "w" ? "piece-white" : "piece-black"}`}
                          >
                            {pieceMap[piece.color][piece.type]}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
              <aside className="game-sidebar">
                {renderClock(opponentColor)}
                <div className="sidebar-middle">
                  <div className="side-block">
                    <span className="side-label">Time control</span>
                    <p>
                      {Math.floor(config.initialSeconds / 60)}+
                      {config.incrementSeconds}
                    </p>
                  </div>
                  <div className="game-actions">
                  <button
                    onClick={() => sendGameAction("surrender")}
                    disabled={role !== "player" || gameOver}
                  >
                    Surrender
                  </button>
                  {drawOffer && drawOffer !== playerColor ? (
                    <div className="draw-response">
                      <span className="draw-notice">Draw offered</span>
                      <div className="draw-response-buttons">
                        <button onClick={() => respondToDraw(true)}>Accept</button>
                        <button onClick={() => respondToDraw(false)}>Decline</button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => sendGameAction("offer-draw")}
                      disabled={role !== "player" || gameOver || Boolean(drawOffer)}
                    >
                      {drawOffer === playerColor ? "Draw offered" : "Offer draw"}
                    </button>
                  )}
                  <button
                    onClick={() => sendGameAction("give-time")}
                    disabled={role !== "player" || gameOver}
                  >
                    Give 15 sec
                  </button>
                  </div>
                </div>
                {renderClock(playerColor)}
              </aside>
            </div>
          )}
        </section>
      )}
      {result && (
        <div className="modal-backdrop" role="presentation">
          <section className="result-modal" role="dialog" aria-modal="true">
            <p className="eyebrow">Match complete</p>
            <h2>{result.type === "checkmate" ? (result.winner === playerColor ? "Checkmate, you won" : "Checkmate, you lost") : result.type === "resignation" && result.winner === playerColor ? "You won" : result.type === "resignation" ? "You resigned" : "Draw agreed"}</h2>
            <p>{result.type === "checkmate" ? `${result.winner === "w" ? "White" : "Black"} won by checkmate.` : result.type === "resignation" ? `${result.loser === "w" ? "White" : "Black"} resigned.` : "The game ended in a draw."}</p>
            <div className="result-actions">
              {rematchOffer && rematchOffer !== playerColor ? (
                <div className="rematch-response">
                  <span className="draw-notice">Your opponent requested a rematch</span>
                  <div className="draw-response-buttons">
                    <button className="confirm-button" onClick={() => respondToRematch(true)}>Accept</button>
                    <button className="secondary-result-button" onClick={() => respondToRematch(false)}>Decline</button>
                  </div>
                </div>
              ) : (
                <button className="confirm-button" onClick={requestRematch} disabled={Boolean(rematchOffer)}>
                  {rematchOffer === playerColor ? "Rematch offered" : "Rematch"} <span>↻</span>
                </button>
              )}
              <button className="secondary-result-button" onClick={leaveRoom}>Back to lobby</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

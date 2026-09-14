import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import { Chess } from 'chess.js';

const app = express();
const server = http.createServer(app);
const isLocalDevOrigin = (origin) => /^http:\/\/(localhost|127\.0\.0\.1):(3000|3001|4173|5173|5174|5175)\/$/.test(origin || '') || /^http:\/\/(localhost|127\.0\.0\.1):(3000|3001|4173|5173|5174|5175)$/.test(origin || '');
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || isLocalDevOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Socket.IO CORS blocked for this origin'));
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

const PORT = process.env.PORT || 3001;
const rooms = new Map();

const createRoomState = () => ({
  fen: new Chess().fen(),
  players: { white: null, black: null },
  mode: 'player',
  config: { color: 'random', variant: 'standard', initialSeconds: 300, incrementSeconds: 0 },
  clocks: { w: 300, b: 300 },
  clockStartedAt: null,
  gameOver: false,
  result: null,
  rematchOffer: null,
  drawOffer: null,
  timeGifts: { w: false, b: false },
  spectators: new Set(),
  messages: [],
  status: 'Waiting for a second player...',
  turn: 'w',
});

const buildRoomPayload = (roomCode, room) => ({
  roomCode,
  fen: room.fen,
  players: room.players,
  mode: room.mode,
  config: room.config,
  clocks: getClockSnapshot(room),
  gameOver: room.gameOver,
  result: room.result,
  rematchOffer: room.rematchOffer,
  drawOffer: room.drawOffer,
  spectators: room.spectators.size,
  messages: room.messages,
  status: room.status,
  turn: room.turn,
});

const getClockSnapshot = (room) => {
  const clocks = { ...room.clocks };
  if (!room.clockStartedAt || room.gameOver) return clocks;

  const elapsed = Math.floor((Date.now() - room.clockStartedAt) / 1000);
  clocks[room.turn] = Math.max(0, clocks[room.turn] - elapsed);
  return clocks;
};

const startClock = (room) => {
  if (!room.clockStartedAt) room.clockStartedAt = Date.now();
};

const updateClockForMove = (room) => {
  const elapsed = room.clockStartedAt ? Math.floor((Date.now() - room.clockStartedAt) / 1000) : 0;
  room.clocks[room.turn] = Math.max(0, room.clocks[room.turn] - elapsed);
  room.clocks[room.turn] += room.config.incrementSeconds;
  room.clockStartedAt = Date.now();
};

const buildRoomList = () => Array.from(rooms.entries()).map(([roomCode, room]) => ({
  roomCode,
  mode: room.mode,
  variant: room.config.variant,
  status: room.status,
  players: {
    white: Boolean(room.players.white),
    black: Boolean(room.players.black),
  },
  spectators: room.spectators.size,
}));

const emitRoomList = () => io.emit('room-list', buildRoomList());

const emitRoomState = (roomCode) => {
  const room = rooms.get(roomCode);
  if (room) io.to(roomCode).emit('room-state', buildRoomPayload(roomCode, room));
};

const makeBotMove = (roomCode) => {
  const room = rooms.get(roomCode);
  if (!room || room.mode !== 'bot' || room.gameOver || !room.players.white || !room.players.black) return;

  const botColor = room.players.white.id === 'bot' ? 'w' : 'b';
  if (room.turn !== botColor) return;

  const chess = new Chess(room.fen);
  const legalMoves = chess.moves({ verbose: true });
  const move = legalMoves[Math.floor(Math.random() * legalMoves.length)];
  if (!move) return;

  updateClockForMove(room);
  chess.move(move);
  room.fen = chess.fen();
  room.turn = chess.turn();
  room.gameOver = chess.isGameOver();
  room.status = chess.isCheckmate()
    ? 'Computer wins by checkmate.'
    : 'Your turn.';
  if (chess.isCheckmate()) {
    room.result = { type: 'checkmate', winner: botColor, loser: botColor === 'w' ? 'b' : 'w' };
  }
  emitRoomState(roomCode);
};

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || isLocalDevOrigin(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error('CORS blocked for this origin'));
  },
  credentials: true,
}));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true, rooms: rooms.size });
});

io.on('connection', (socket) => {
  socket.on('request-rooms', () => {
    socket.emit('room-list', buildRoomList());
  });

  socket.on('create-room', ({ mode = 'player', color = 'random', variant = 'standard', initialSeconds = 300, incrementSeconds = 0 } = {}) => {
    let roomCode = '';
    while (!roomCode || rooms.has(roomCode)) {
      roomCode = Array.from({ length: 4 }, () =>
        'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]
      ).join('');
    }

    const room = createRoomState();
    room.turn = 'w';
    room.mode = mode === 'bot' ? 'bot' : 'player';
    room.config = {
      color: ['white', 'black', 'random'].includes(color) ? color : 'random',
      variant: ['standard', 'chess960', 'king-of-the-hill', 'three-check', 'seirawan'].includes(variant) ? variant : 'standard',
      initialSeconds: Math.max(60, Number(initialSeconds) || 300),
      incrementSeconds: Math.max(0, Number(incrementSeconds) || 0),
    };
    room.clocks = { w: room.config.initialSeconds, b: room.config.initialSeconds };
    const creatorColor = room.config.color === 'black' ? 'b' : 'w';
    room.players[creatorColor === 'w' ? 'white' : 'black'] = { id: socket.id, name: creatorColor === 'w' ? 'White' : 'Black' };
    if (room.mode === 'bot') {
      const botColor = creatorColor === 'w' ? 'black' : 'white';
      room.players[botColor] = { id: 'bot', name: 'Computer' };
      room.turn = botColor === 'white' ? 'w' : 'b';
      room.status = creatorColor === 'w' ? 'Your turn.' : 'Computer is thinking...';
      if (creatorColor === 'w') startClock(room);
    }
    rooms.set(roomCode, room);
    socket.data.roomCode = roomCode;
    socket.data.role = 'player';
    socket.data.color = creatorColor;
    socket.join(roomCode);
    socket.emit('room-joined', { roomCode, color: creatorColor });
    emitRoomState(roomCode);
    emitRoomList();
    if (room.mode === 'bot' && creatorColor === 'b') setTimeout(() => makeBotMove(roomCode), 500);
  });

  socket.on('join-room', ({ roomCode, role = 'player' }) => {
    const normalized = String(roomCode || '').trim().toUpperCase();
    const room = rooms.get(normalized);

    if (!room) {
      socket.emit('room-error', 'Room not found.');
      return;
    }

    if (role === 'spectator') {
      room.spectators.add(socket.id);
      socket.data.roomCode = normalized;
      socket.data.role = 'spectator';
      socket.join(normalized);
      socket.emit('room-joined', { roomCode: normalized, color: null, role: 'spectator' });
      emitRoomState(normalized);
      return;
    }

    if (room.players.white && room.players.black) {
      socket.emit('room-error', 'This room is already full.');
      return;
    }

    const joinColor = room.players.white ? 'b' : 'w';
    room.players[joinColor === 'w' ? 'white' : 'black'] = { id: socket.id, name: joinColor === 'w' ? 'White' : 'Black' };
    room.status = `${room.turn === 'w' ? 'White' : 'Black'} to move.`;
    startClock(room);
    socket.data.roomCode = normalized;
    socket.data.role = 'player';
    socket.data.color = joinColor;
    socket.join(normalized);
    socket.emit('room-joined', { roomCode: normalized, color: joinColor, role: 'player' });
    emitRoomState(normalized);
    emitRoomList();
  });

  socket.on('send-message', ({ roomCode, text }) => {
    const room = rooms.get(String(roomCode || '').trim().toUpperCase());
    if (!room) return;

    const cleanText = String(text || '').trim();
    if (!cleanText) return;

    room.messages.push({ sender: socket.id.slice(0, 4), text: cleanText });
    emitRoomState(roomCode);
  });

  socket.on('surrender', ({ roomCode }) => {
    const normalized = String(roomCode || '').trim().toUpperCase();
    const room = rooms.get(normalized);
    if (!room || socket.data.roomCode !== normalized || socket.data.role !== 'player') return;

    room.gameOver = true;
    room.clockStartedAt = null;
    room.status = `${socket.data.color === 'w' ? 'White' : 'Black'} resigned.`;
    room.result = {
      type: 'resignation',
      winner: socket.data.color === 'w' ? 'b' : 'w',
      loser: socket.data.color,
    };
    emitRoomState(normalized);
  });

  socket.on('offer-draw', ({ roomCode }) => {
    const normalized = String(roomCode || '').trim().toUpperCase();
    const room = rooms.get(normalized);
    if (!room || socket.data.roomCode !== normalized || socket.data.role !== 'player' || room.gameOver) return;

    room.drawOffer = socket.data.color;
    room.status = `${socket.data.color === 'w' ? 'White' : 'Black'} offered a draw.`;
    emitRoomState(normalized);
  });

  socket.on('respond-draw', ({ roomCode, accept }) => {
    const normalized = String(roomCode || '').trim().toUpperCase();
    const room = rooms.get(normalized);
    if (!room || socket.data.roomCode !== normalized || socket.data.role !== 'player' || room.gameOver || !room.drawOffer || room.drawOffer === socket.data.color) return;

    if (accept) {
      room.gameOver = true;
      room.clockStartedAt = null;
      room.status = 'Draw agreed.';
      room.result = { type: 'draw' };
    } else {
      room.status = 'Draw offer declined.';
    }
    room.drawOffer = null;
    emitRoomState(normalized);
  });

  socket.on('give-time', ({ roomCode }) => {
    const normalized = String(roomCode || '').trim().toUpperCase();
    const room = rooms.get(normalized);
    if (!room || socket.data.roomCode !== normalized || socket.data.role !== 'player' || room.gameOver || room.timeGifts[socket.data.color]) return;

    const opponent = socket.data.color === 'w' ? 'b' : 'w';
    room.clocks[opponent] += 15;
    room.timeGifts[socket.data.color] = true;
    emitRoomState(normalized);
  });

  socket.on('rematch', ({ roomCode }) => {
    const normalized = String(roomCode || '').trim().toUpperCase();
    const room = rooms.get(normalized);
    if (!room || socket.data.roomCode !== normalized || socket.data.role !== 'player' || !room.gameOver) {
      socket.emit('room-error', 'Rematch is only available after the game ends.');
      return;
    }
    if (!room.players.white || !room.players.black) {
      socket.emit('room-error', 'Both players must be present to request a rematch.');
      return;
    }

    if (room.rematchOffer) {
      socket.emit('room-error', 'A rematch offer is already waiting.');
      return;
    }
    room.rematchOffer = socket.data.color;
    room.status = `${socket.data.color === 'w' ? 'White' : 'Black'} requested a rematch.`;
    emitRoomState(normalized);
  });

  socket.on('respond-rematch', ({ roomCode, accept }) => {
    const normalized = String(roomCode || '').trim().toUpperCase();
    const room = rooms.get(normalized);
    if (!room || socket.data.roomCode !== normalized || socket.data.role !== 'player' || !room.gameOver || !room.rematchOffer || room.rematchOffer === socket.data.color) return;

    if (accept) {
      room.fen = new Chess().fen();
      room.turn = 'w';
      room.clocks = { w: room.config.initialSeconds, b: room.config.initialSeconds };
      room.clockStartedAt = Date.now();
      room.gameOver = false;
      room.result = null;
      room.rematchOffer = null;
      room.drawOffer = null;
      room.timeGifts = { w: false, b: false };
      room.status = 'White to move.';
    } else {
      room.rematchOffer = null;
      room.status = 'Rematch declined.';
    }
    emitRoomState(normalized);
  });

  socket.on('make-move', ({ roomCode, move }) => {
    const normalized = String(roomCode || '').trim().toUpperCase();
    const room = rooms.get(normalized);
    if (!room) return;

    if (socket.data.roomCode !== normalized || socket.data.role !== 'player' || room.gameOver || room.players[socket.data.color === 'w' ? 'white' : 'black']?.id !== socket.id || room.turn !== socket.data.color) {
      socket.emit('room-error', 'It is not your turn.');
      return;
    }

    if (getClockSnapshot(room)[room.turn] <= 0) {
      room.gameOver = true;
      room.clockStartedAt = null;
      room.status = `${room.turn === 'w' ? 'White' : 'Black'} ran out of time.`;
      emitRoomState(normalized);
      return;
    }

    const chess = new Chess(room.fen);
    let result;

    try {
      result = chess.move(move);
    } catch {
      socket.emit('room-error', 'Illegal move.');
      return;
    }

    if (!result) {
      socket.emit('room-error', 'Illegal move.');
      return;
    }

    updateClockForMove(room);
    room.fen = chess.fen();
    room.turn = chess.turn();
    room.gameOver = chess.isGameOver();
    room.drawOffer = null;
    room.status = room.mode === 'bot'
      ? 'Computer is thinking...'
      : chess.turn() === 'w' ? 'White to move.' : 'Black to move.';

    if (chess.isCheckmate()) {
      room.status = `${chess.turn() === 'w' ? 'Black' : 'White'} wins by checkmate.`;
      room.result = {
        type: 'checkmate',
        winner: chess.turn() === 'w' ? 'b' : 'w',
        loser: chess.turn(),
      };
    }

    emitRoomState(normalized);
    if (room.mode === 'bot' && !room.gameOver) {
      setTimeout(() => makeBotMove(normalized), 500);
    }
  });

  socket.on('disconnect', () => {
    for (const [roomCode, room] of rooms.entries()) {
      if (room.players.white?.id === socket.id) {
        room.players.white = null;
        room.status = 'White disconnected. Waiting for a new challenger.';
      }

      if (room.players.black?.id === socket.id) {
        room.players.black = null;
        room.status = 'Black disconnected. Waiting for a new challenger.';
      }

      room.spectators.delete(socket.id);

      if (!room.players.white && !room.players.black) {
        rooms.delete(roomCode);
      } else {
        emitRoomState(roomCode);
      }
    }
    emitRoomList();
  });
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Stop the stale server and retry.`);
    process.exit(1);
  }

  throw error;
});

setInterval(() => {
  for (const [roomCode, room] of rooms.entries()) {
    if (!room.clockStartedAt || room.gameOver) continue;

    if (getClockSnapshot(room)[room.turn] <= 0) {
      room.gameOver = true;
      room.clockStartedAt = null;
      room.status = `${room.turn === 'w' ? 'White' : 'Black'} ran out of time.`;
    }

    emitRoomState(roomCode);
  }
}, 1000);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Chess server listening on port ${PORT}`);
});

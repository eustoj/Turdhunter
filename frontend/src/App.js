import { useState, useEffect } from "react";
import "./App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import axios from "axios";
import { FaFlag, FaPoop, FaQuestionCircle } from "react-icons/fa";
import { IoMdSettings } from "react-icons/io";
import Confetti from 'react-confetti';
import { v4 as uuidv4 } from 'uuid';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Emoji faces for different proximity values
const emojis = {
  0: '😊', // Happy face
  1: '🤢', // Slightly disgusted (peg on nose) 
  2: '😕', // Slightly unhappy
  3: '😟', // Moderately unhappy
  4: '😣', // Very unhappy
  5: '😫', // Extremely unhappy
  6: '😩', // Almost at turd
  7: '🤮', // Totally disgusted
  8: '🤧', // Sickly
  turd: <FaPoop className="text-brown-600 text-2xl" /> // The turd itself
};

// Game difficulty settings
const difficultySettings = {
  easy: { label: "Easy", size: 10, turds: 10 },
  average: { label: "Average", size: 15, turds: 30 },
  expert: { label: "Expert", size: 30, turds: 99 },
  genius: { label: "TurdHunter Genius", size: 50, turds: 250, premium: true },
  insanity: { label: "Turdsanity!", size: 80, turds: 650, premium: true }
};

// Cell component for game board
const Cell = ({ value, revealed, flagged, onClick, onRightClick }) => {
  const getContent = () => {
    if (flagged) return <FaFlag className="text-red-500" />;
    if (!revealed) return null;
    if (value === 'X') return emojis.turd;
    return emojis[value] || value;
  };

  const getCellClass = () => {
    let cellClass = "cell flex items-center justify-center border rounded-lg overflow-hidden ";
    
    if (revealed) {
      if (value === 'X') {
        cellClass += "bg-red-200 ";
      } else if (value === 0) {
        cellClass += "bg-green-100 ";
      } else {
        cellClass += "bg-yellow-100 ";
      }
    } else {
      cellClass += "bg-blue-200 hover:bg-blue-300 cursor-pointer ";
    }
    
    return cellClass;
  };

  return (
    <div 
      className={getCellClass()}
      onClick={onClick}
      onContextMenu={onRightClick}
    >
      {getContent()}
    </div>
  );
};

// Game board component
const GameBoard = ({ difficulty, playerName, onBackToMenu, onUseSnifferPower, snifferPowerCount }) => {
  const [board, setBoard] = useState([]);
  const [revealed, setRevealed] = useState([]);
  const [flagged, setFlagged] = useState([]);
  const [gameOver, setGameOver] = useState(false);
  const [gameWon, setGameWon] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [moveCount, setMoveCount] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [turdLocations, setTurdLocations] = useState([]);
  
  const { size, turds } = difficultySettings[difficulty];
  
  // Initialize the game board
  useEffect(() => {
    initializeGame();
  }, [difficulty]);
  
  // Timer logic
  useEffect(() => {
    let timer;
    if (gameStarted && !gameOver && !gameWon) {
      timer = setInterval(() => {
        setTimeElapsed(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [gameStarted, gameOver, gameWon]);
  
  // Initialize the game board with turds and proximity numbers
  const initializeGame = () => {
    const newBoard = Array(size).fill().map(() => Array(size).fill(0));
    const newRevealed = Array(size).fill().map(() => Array(size).fill(false));
    const newFlagged = Array(size).fill().map(() => Array(size).fill(false));
    let turdPositions = [];
    
    // Place turds randomly
    let turdsPlaced = 0;
    while (turdsPlaced < turds) {
      const row = Math.floor(Math.random() * size);
      const col = Math.floor(Math.random() * size);
      
      if (newBoard[row][col] !== 'X') {
        newBoard[row][col] = 'X';
        turdPositions.push({ row, col });
        turdsPlaced++;
        
        // Update adjacent cell values
        for (let i = -1; i <= 1; i++) {
          for (let j = -1; j <= 1; j++) {
            const newRow = row + i;
            const newCol = col + j;
            
            if (newRow >= 0 && newRow < size && newCol >= 0 && newCol < size && newBoard[newRow][newCol] !== 'X') {
              newBoard[newRow][newCol]++;
            }
          }
        }
      }
    }
    
    setBoard(newBoard);
    setRevealed(newRevealed);
    setFlagged(newFlagged);
    setGameOver(false);
    setGameWon(false);
    setTimeElapsed(0);
    setMoveCount(0);
    setGameStarted(false);
    setTurdLocations(turdPositions);
  };
  
  // Reveal a cell and handle game logic
  const revealCell = (row, col, fromSniffer = false) => {
    if (gameOver || gameWon || flagged[row][col]) return;
    
    if (!gameStarted) {
      setGameStarted(true);
    }
    
    if (!fromSniffer) {
      setMoveCount(prev => prev + 1);
    }
    
    const newRevealed = [...revealed.map(row => [...row])];
    
    // If cell is already revealed, do nothing
    if (newRevealed[row][col]) return;
    
    newRevealed[row][col] = true;
    setRevealed(newRevealed);
    
    // If turd is revealed, game over
    if (board[row][col] === 'X') {
      setGameOver(true);
      revealAllTurds();
      saveGameScore(false);
      return;
    }
    
    // If empty cell (0), reveal adjacent cells
    if (board[row][col] === 0) {
      revealAdjacentCells(row, col, newRevealed);
    }
    
    // Check if player won
    const hasWon = checkWinCondition(newRevealed);
    if (hasWon) {
      setGameWon(true);
      saveGameScore(true);
    }
  };
  
  // Reveal adjacent cells recursively (for empty cells)
  const revealAdjacentCells = (row, col, newRevealed) => {
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        const newRow = row + i;
        const newCol = col + j;
        
        if (
          newRow >= 0 && newRow < size && 
          newCol >= 0 && newCol < size && 
          !newRevealed[newRow][newCol] && 
          !flagged[newRow][newCol]
        ) {
          newRevealed[newRow][newCol] = true;
          
          if (board[newRow][newCol] === 0) {
            revealAdjacentCells(newRow, newCol, newRevealed);
          }
        }
      }
    }
  };
  
  // Toggle flag on a cell
  const toggleFlag = (row, col) => {
    if (gameOver || gameWon || revealed[row][col]) return;
    
    if (!gameStarted) {
      setGameStarted(true);
    }
    
    const newFlagged = [...flagged.map(row => [...row])];
    newFlagged[row][col] = !newFlagged[row][col];
    setFlagged(newFlagged);
  };
  
  // Check if the player has won
  const checkWinCondition = (newRevealed) => {
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        // If a non-turd cell is not revealed, player hasn't won yet
        if (board[row][col] !== 'X' && !newRevealed[row][col]) {
          return false;
        }
      }
    }
    return true;
  };
  
  // Reveal all turds when game is over
  const revealAllTurds = () => {
    const newRevealed = [...revealed.map(row => [...row])];
    
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        if (board[row][col] === 'X') {
          newRevealed[row][col] = true;
        }
      }
    }
    
    setRevealed(newRevealed);
  };
  
  // Save game score to backend
  const saveGameScore = async (completed) => {
    try {
      await axios.post(`${API}/scores`, {
        player_name: playerName || "Anonymous",
        difficulty,
        time_seconds: timeElapsed,
        moves: moveCount,
        completed
      });
    } catch (error) {
      console.error("Error saving score:", error);
    }
  };
  
  // Use super sniffer power to reveal safe cells
  const useSnifferPower = () => {
    if (snifferPowerCount <= 0 || gameOver || gameWon) return;
    
    // Find safe cells that are not yet revealed
    const safeCells = [];
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        if (!revealed[row][col] && board[row][col] !== 'X') {
          safeCells.push({ row, col });
        }
      }
    }
    
    // Randomly select up to 4 safe cells to reveal
    if (safeCells.length > 0) {
      const cellsToReveal = safeCells
        .sort(() => 0.5 - Math.random())
        .slice(0, Math.min(4, safeCells.length));
      
      cellsToReveal.forEach(({ row, col }) => {
        revealCell(row, col, true);
      });
      
      onUseSnifferPower();
    }
  };
  
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  return (
    <div className="flex flex-col items-center w-full max-w-6xl">
      {gameWon && <Confetti width={window.innerWidth} height={window.innerHeight} recycle={false} />}
      
      <div className="w-full flex justify-between items-center p-4 bg-blue-100 rounded-lg mb-4">
        <button 
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
          onClick={onBackToMenu}
        >
          Back to Menu
        </button>
        
        <div className="text-center">
          <h2 className="text-2xl font-bold">{difficultySettings[difficulty].label}</h2>
          <p>Time: {formatTime(timeElapsed)} | Moves: {moveCount}</p>
        </div>
        
        <button 
          className={`px-4 py-2 rounded-lg ${snifferPowerCount > 0 
            ? 'bg-green-500 hover:bg-green-600 text-white' 
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
          onClick={useSnifferPower}
          disabled={snifferPowerCount <= 0}
        >
          Super Sniffer ({snifferPowerCount})
        </button>
      </div>
      
      {(gameOver || gameWon) && (
        <div className="mb-4 p-4 rounded-lg text-center text-white font-bold text-xl w-full" 
          style={{ backgroundColor: gameWon ? '#4CAF50' : '#F44336' }}
        >
          {gameWon 
            ? "Congratulations! You found all the turds!" 
            : "Game Over! You stepped on a turd!"}
        </div>
      )}
      
      <div 
        className="game-board"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${size}, 1fr)`,
          gap: '2px',
          maxWidth: '100%',
          maxHeight: '70vh',
          overflow: 'auto'
        }}
      >
        {board.map((row, rowIndex) => (
          row.map((cell, colIndex) => (
            <Cell
              key={`${rowIndex}-${colIndex}`}
              value={cell}
              revealed={revealed[rowIndex][colIndex]}
              flagged={flagged[rowIndex][colIndex]}
              onClick={() => revealCell(rowIndex, colIndex)}
              onRightClick={(e) => {
                e.preventDefault();
                toggleFlag(rowIndex, colIndex);
              }}
            />
          ))
        ))}
      </div>
      
      {(gameOver || gameWon) && (
        <div className="mt-4 flex gap-4">
          <button 
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg"
            onClick={initializeGame}
          >
            Play Again
          </button>
          <button 
            className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-lg"
            onClick={onBackToMenu}
          >
            Change Difficulty
          </button>
        </div>
      )}
    </div>
  );
};

// Settings Modal Component
const SettingsModal = ({ isOpen, onClose, playerName, setPlayerName }) => {
  const [name, setName] = useState(playerName);
  
  const handleSave = () => {
    setPlayerName(name);
    onClose();
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md w-full">
        <h2 className="text-2xl font-bold mb-4">Settings</h2>
        
        <div className="mb-4">
          <label className="block text-gray-700 mb-2">Player Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
            placeholder="Enter your name"
          />
        </div>
        
        <div className="flex justify-end gap-2">
          <button 
            className="bg-gray-300 hover:bg-gray-400 px-4 py-2 rounded-lg"
            onClick={onClose}
          >
            Cancel
          </button>
          <button 
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
            onClick={handleSave}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

// Help Modal Component
const HelpModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">How to Play Turd Hunter</h2>
        
        <div className="space-y-4">
          <p>Turd Hunter is a game similar to Minesweeper, but instead of avoiding mines, you're trying to find all the turds!</p>
          
          <h3 className="text-xl font-bold">Game Rules:</h3>
          <ul className="list-disc pl-5 space-y-2">
            <li>Click on squares to reveal what's underneath.</li>
            <li>The numbers indicate how many turds are in the adjacent squares.</li>
            <li>Right-click to place a flag where you think a turd is.</li>
            <li>If you click on a turd, game over!</li>
            <li>To win, reveal all squares that don't contain turds.</li>
          </ul>
          
          <h3 className="text-xl font-bold">Emoji Guide:</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <div className="text-2xl">{emojis[0]}</div>
              <div>No turds nearby</div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-2xl">{emojis[1]}</div>
              <div>1 turd nearby</div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-2xl">{emojis[3]}</div>
              <div>3 turds nearby</div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-2xl"><FaFlag className="text-red-500" /></div>
              <div>Flag (possible turd)</div>
            </div>
          </div>
          
          <h3 className="text-xl font-bold">Features:</h3>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Super Sniffer:</strong> Reveals 4 safe squares. Get it by watching an ad.</li>
            <li><strong>Premium Levels:</strong> Subscribe for just £1.99/month to unlock the ultimate challenges.</li>
          </ul>
        </div>
        
        <div className="flex justify-end mt-6">
          <button 
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
            onClick={onClose}
          >
            Got it!
          </button>
        </div>
      </div>
    </div>
  );
};

// Subscription Modal Component
const SubscriptionModal = ({ isOpen, onClose, onSubscribe }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md w-full">
        <h2 className="text-2xl font-bold mb-4">Unlock Premium Levels</h2>
        
        <div className="space-y-4">
          <p>Subscribe to Turd Hunter Premium to unlock:</p>
          
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>TurdHunter Genius</strong> - Massive 50x50 grid with 250 turds!</li>
            <li><strong>Turdsanity!</strong> - Epic 80x80 grid with 650 turds for true masters!</li>
            <li>Ad-free experience across all levels</li>
          </ul>
          
          <div className="bg-blue-100 p-4 rounded-lg text-center">
            <p className="font-bold text-xl">£1.99 per month</p>
            <p className="text-sm text-gray-600">Cancel anytime</p>
          </div>
        </div>
        
        <div className="flex justify-end gap-2 mt-6">
          <button 
            className="bg-gray-300 hover:bg-gray-400 px-4 py-2 rounded-lg"
            onClick={onClose}
          >
            Maybe Later
          </button>
          <button 
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
            onClick={() => {
              onSubscribe();
              onClose();
            }}
          >
            Subscribe Now
          </button>
        </div>
      </div>
    </div>
  );
};

// Ad Modal Component
const AdModal = ({ isOpen, onClose, onWatchComplete }) => {
  const [adWatched, setAdWatched] = useState(false);
  const [countdown, setCountdown] = useState(5);
  
  useEffect(() => {
    let timer;
    if (isOpen && !adWatched && countdown > 0) {
      timer = setTimeout(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
    } else if (isOpen && countdown === 0 && !adWatched) {
      setAdWatched(true);
    }
    
    return () => clearTimeout(timer);
  }, [isOpen, countdown, adWatched]);
  
  const handleCompleteAd = () => {
    onWatchComplete();
    onClose();
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md w-full">
        <h2 className="text-2xl font-bold mb-4">Watch Ad for Super Sniffer</h2>
        
        <div className="space-y-4">
          {!adWatched ? (
            <>
              <div className="bg-gray-200 rounded-lg p-12 flex items-center justify-center">
                <p className="text-center">Advertisement Loading...</p>
                <p className="text-xl font-bold">{countdown}</p>
              </div>
              <p className="text-center text-sm text-gray-600">Please wait {countdown} seconds...</p>
            </>
          ) : (
            <>
              <div className="bg-green-100 p-4 rounded-lg text-center">
                <p className="font-bold text-xl">Thanks for watching!</p>
                <p>You've earned a Super Sniffer power-up.</p>
              </div>
              
              <button 
                className="w-full bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg"
                onClick={handleCompleteAd}
              >
                Claim Super Sniffer
              </button>
            </>
          )}
        </div>
        
        {!adWatched && (
          <div className="flex justify-end mt-6">
            <button 
              className="bg-gray-300 hover:bg-gray-400 px-4 py-2 rounded-lg"
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Main Home component
const Home = () => {
  const [gameStarted, setGameStarted] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState(null);
  const [playerName, setPlayerName] = useState("Player");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [snifferPowerCount, setSnifferPowerCount] = useState(0);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [showAdModal, setShowAdModal] = useState(false);
  const [highScores, setHighScores] = useState([]);
  const [playerId, setPlayerId] = useState(() => {
    const storedId = localStorage.getItem('playerId');
    return storedId || uuid.v4();
  });
  
  // Check subscription status on load
  useEffect(() => {
    localStorage.setItem('playerId', playerId);
    checkSubscriptionStatus();
    fetchHighScores();
    
    // Test API connection
    const testApiConnection = async () => {
      try {
        const response = await axios.get(`${API}/`);
        console.log(response.data.message);
      } catch (e) {
        console.error("API connection error:", e);
      }
    };
    
    testApiConnection();
  }, []);
  
  // Check user's subscription status
  const checkSubscriptionStatus = async () => {
    try {
      const response = await axios.get(`${API}/subscription/${playerId}`);
      setIsSubscribed(response.data.is_subscribed);
    } catch (error) {
      console.error("Error checking subscription:", error);
    }
  };
  
  // Update subscription status
  const handleSubscribe = async () => {
    try {
      await axios.post(`${API}/subscription/${playerId}`, {
        is_subscribed: true
      });
      setIsSubscribed(true);
    } catch (error) {
      console.error("Error updating subscription:", error);
    }
  };
  
  // Fetch high scores
  const fetchHighScores = async () => {
    try {
      const response = await axios.get(`${API}/scores?limit=5`);
      setHighScores(response.data);
    } catch (error) {
      console.error("Error fetching high scores:", error);
    }
  };
  
  // Start a new game with selected difficulty
  const startGame = (difficulty) => {
    if (difficultySettings[difficulty].premium && !isSubscribed) {
      setShowSubscriptionModal(true);
      return;
    }
    
    setSelectedDifficulty(difficulty);
    setGameStarted(true);
  };
  
  // Handle when a player uses their super sniffer power
  const handleUseSnifferPower = () => {
    setSnifferPowerCount(prev => Math.max(0, prev - 1));
  };
  
  // Handle watching an ad to get super sniffer power
  const handleWatchAd = () => {
    setShowAdModal(true);
  };
  
  // Handle after successfully watching an ad
  const handleAdWatchComplete = () => {
    setSnifferPowerCount(prev => prev + 1);
  };
  
  // Format timestamp for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };
  
  if (gameStarted && selectedDifficulty) {
    return (
      <GameBoard 
        difficulty={selectedDifficulty}
        playerName={playerName}
        onBackToMenu={() => setGameStarted(false)}
        onUseSnifferPower={handleUseSnifferPower}
        snifferPowerCount={snifferPowerCount}
      />
    );
  }
  
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-blue-50">
      <div className="text-center mb-8">
        <h1 className="text-5xl font-bold text-blue-600 mb-2">Turd Hunter</h1>
        <p className="text-xl text-gray-600">Find the turds without stepping on them!</p>
      </div>
      
      <div className="w-full max-w-4xl bg-white rounded-xl shadow-lg p-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Select Difficulty</h2>
          <div className="flex gap-2">
            <button 
              className="p-2 rounded-full bg-gray-200 hover:bg-gray-300"
              onClick={() => setShowHelpModal(true)}
            >
              <FaQuestionCircle size={24} />
            </button>
            <button 
              className="p-2 rounded-full bg-gray-200 hover:bg-gray-300"
              onClick={() => setShowSettingsModal(true)}
            >
              <IoMdSettings size={24} />
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {Object.entries(difficultySettings).map(([key, { label, size, turds, premium }]) => (
            <button
              key={key}
              className={`p-4 rounded-lg text-center ${
                premium && !isSubscribed
                  ? 'bg-gray-200 cursor-not-allowed'
                  : 'bg-blue-100 hover:bg-blue-200'
              }`}
              onClick={() => startGame(key)}
              disabled={premium && !isSubscribed}
            >
              <h3 className="text-xl font-bold mb-1">{label}</h3>
              <p className="text-gray-600">{size}x{size} grid, {turds} turds</p>
              {premium && !isSubscribed && (
                <div className="mt-2 text-sm font-medium text-gray-500">
                  Premium Only 🔒
                </div>
              )}
            </button>
          ))}
        </div>
        
        <div className="flex flex-col md:flex-row gap-6 mb-8">
          <div className="flex-1 bg-blue-100 rounded-lg p-4">
            <h3 className="text-xl font-bold mb-4">Power-ups</h3>
            <div className="flex justify-between items-center">
              <div>
                <p className="font-medium">Super Sniffer</p>
                <p className="text-sm text-gray-600">Reveals 4 safe squares</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold">{snifferPowerCount}</span>
                <button 
                  className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded"
                  onClick={handleWatchAd}
                >
                  Watch Ad
                </button>
              </div>
            </div>
          </div>
          
          <div className="flex-1 bg-blue-100 rounded-lg p-4">
            <h3 className="text-xl font-bold mb-4">Premium Status</h3>
            {isSubscribed ? (
              <div className="text-center">
                <div className="text-green-600 font-bold mb-2">SUBSCRIBED</div>
                <p className="text-sm">All premium levels unlocked!</p>
              </div>
            ) : (
              <div className="text-center">
                <p className="mb-2">Unlock premium levels and remove ads</p>
                <button 
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
                  onClick={() => setShowSubscriptionModal(true)}
                >
                  Subscribe - £1.99/month
                </button>
              </div>
            )}
          </div>
        </div>
        
        <div className="bg-blue-100 rounded-lg p-4">
          <h3 className="text-xl font-bold mb-4">High Scores</h3>
          {highScores.length > 0 ? (
            <table className="w-full">
              <thead>
                <tr className="border-b border-blue-200">
                  <th className="text-left py-2">Player</th>
                  <th className="text-left py-2">Difficulty</th>
                  <th className="text-left py-2">Time</th>
                  <th className="text-left py-2">Moves</th>
                  <th className="text-left py-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {highScores.map((score, index) => (
                  <tr key={score.id} className={index % 2 === 0 ? 'bg-blue-50' : ''}>
                    <td className="py-2">{score.player_name}</td>
                    <td className="py-2">{score.difficulty}</td>
                    <td className="py-2">{Math.floor(score.time_seconds / 60)}:{(score.time_seconds % 60).toString().padStart(2, '0')}</td>
                    <td className="py-2">{score.moves}</td>
                    <td className="py-2">{formatDate(score.timestamp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-center text-gray-600">No high scores yet. Be the first!</p>
          )}
        </div>
      </div>
      
      {/* Modals */}
      <SettingsModal 
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        playerName={playerName}
        setPlayerName={setPlayerName}
      />
      
      <HelpModal
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
      />
      
      <SubscriptionModal
        isOpen={showSubscriptionModal}
        onClose={() => setShowSubscriptionModal(false)}
        onSubscribe={handleSubscribe}
      />
      
      <AdModal
        isOpen={showAdModal}
        onClose={() => setShowAdModal(false)}
        onWatchComplete={handleAdWatchComplete}
      />
    </div>
  );
};

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />}>
            <Route index element={<Home />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;

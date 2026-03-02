**Shadow Verdict** is a real-time multiplayer social deduction game, offering a fast-paced, party-friendly version of the classic game Mafia. Built with React and powered by Node.js, it provides an engaging experience with a rich feature set for both players and hosts.

## ✨ Features

-   **Real-time Multiplayer:** Seamless gameplay powered by WebSockets for an instant, responsive experience.
-   **Lobby System:** Create public or private rooms with unique 4-digit codes.
-   **Extensive Role Library:** Dozens of unique roles across Town, Mafia, and Neutral alignments, each with distinct abilities and win conditions.
-   **Customizable Game Settings:** Tailor your game with settings for player count, timers, voting mechanics, role reveals, and more.
-   **In-Game Communication:** Engage in public day-time discussions, and strategize with teammates in a private Mafia chat.
-   **Night Phase Actions:** Use your role's special abilities during the night to heal, investigate, block, or eliminate other players.
-   **Bots for Practice:** Fill empty slots or play solo against AI bots with varying difficulty levels.
-   **Dynamic Game Flow:** Experience distinct game phases including Lobby, Role Reveal, Day, Night, and special events like the Hunter's final shot.

## 🛠️ Tech Stack

-   **Frontend:** React, TypeScript, Vite, Tailwind CSS
-   **Backend:** Node.js, Express, TypeScript, `tsx`
-   **Real-time Communication:** Socket.IO
-   **AI Integration:** Google Gemini API (`@google/genai`)

## 🚀 Getting Started

Follow these instructions to get a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

-   [Node.js](https://nodejs.org/en/) (v18 or later recommended)
-   [npm](https://www.npmjs.com/)

### Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/xanpavle/Shadow-Verdict.git
    cd Shadow-Verdict
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up environment variables:**
    Create a `.env` file in the root of the project by copying the example file:
    ```bash
    cp .env.example .env
    ```
    Open the newly created `.env` file and add your Gemini API key. You can get a key from [Google AI Studio](https://aistudio.google.com/app/apikey).
    ```
    GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
    ```

4.  **Run the development server:**
    This command starts both the frontend and backend servers concurrently.
    ```bash
    npm run dev
    ```
    The application will be available at `http://localhost:3000`.

## 📖 How to Play

**Shadow Verdict** pits two main factions, the **Town** and the **Mafia**, against each other. There are also **Neutral** players who have their own unique objectives.

-   **Objective:**
    -   **Town:** Eliminate all members of the Mafia.
    -   **Mafia:** Outnumber or equal the remaining Town members.
    -   **Neutral:** Fulfill your specific role's win condition (e.g., getting lynched as the Jester).

-   **Game Phases:**
    1.  **Role Reveal:** At the start of the game, you are secretly assigned a role.
    2.  **Night Phase:** The game begins at night. Players with night abilities can perform their actions (e.g., Mafia votes to kill, Healer protects, Cop investigates).
    3.  **Day Phase:** All players convene to discuss the events of the night. After a discussion period, players vote to lynch one person they suspect is a member of the Mafia.
    4.  The cycle repeats (Night -> Day -> Night...) until one faction achieves its win condition.

## 📂 Project Structure

```
.
├── src
│   ├── client/          # Frontend source code
│   │   ├── components/  # React components (Lobby, GameView, etc.)
│   │   └── socket.ts    # Client-side socket.io setup
│   ├── server/          # Backend source code
│   │   ├── game.ts      # Core game logic and state management (GameManager class)
│   │   └── socket.ts    # Server-side socket.io event handlers
│   └── shared/          # Code shared between client and server
│       └── types.ts     # TypeScript interfaces and type definitions (Player, GameState, Role, etc.)
├── server.ts            # Main server entry point (Express, Vite Middleware, Socket.IO)
├── vite.config.ts       # Vite configuration
├── package.json         # Project dependencies and scripts
└── tsconfig.json        # TypeScript compiler options
```

# Assignment 1 - 8 Queens Problem  

This assignment is part of **CS 4200: Artificial Intelligence (Fall 2025)** at **California State Polytechnic University, Pomona (CPP).**

## Overview
1. Write a GUI-based program that can place 8 queens in such a manner on an 8×8 chessboard that no queens attack each other.
2. Use a heuristic function for the 8-queens problem that estimates how close a given board state is to a solution.  
   The goal state is one where no queens are attacking each other.  
   *Note: A pair of queens is considered "attacking" if they are in the same row, same column, or on the same diagonal.*

[Demo Video](assets/icons/demo.gif)
  A short recorded walkthrough showing how the 8-Queens visualization works.

[Live Web Demo - Assignment 1](https://itistamtran.github.io/cpp-cs4200-artificial-intelligence-fall25/asgn1-8-queens-problem/web/index.html)
  Try the visualization directly in your browser (interactive).
  
In this assignment, I implemented two approaches to solve the problem:

- **A\* Search** (with heuristic function based on attacking pairs).  
- **Backtracking** (recursive search with conflict detection). 

Both implementations include step-by-step visualizations to show how the solution is reached.

## Features
- **Python version**:  
  - Run with `python -m src.gui.app`.  
  - Provides a Tkinter GUI where you can edit, run, and watch the solving process.  
- **Web version**:  
  - Built with HTML, CSS, and JavaScript.  
  - Interactive chessboard that lets you place queens manually (Edit Mode) or watch the computer solve it (Play Mode).  
  - Supports **step-by-step playback** or **automatic animation** with adjustable speed.  

## How to Run

### Python (GUI)
```bash
# 1. Navigate to the assignment folder:
cd asgn1-8-queens-problem

# 2. Run the GUI:
python -m src.gui.app

# 3. Web (Browser)
cd asgn1-8-queens-problem/web   # Go to the web/ folder
python -m http.server 8000      # Start a local server

# Open in browser:
# http://localhost:8000/index.html
    
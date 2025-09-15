# Heuristic Function: Number of attacking pairs of queens

from typing import List

board_size = 8  # Board size
Board = List[int]


def attacking_pairs(board: Board) -> int:
    """Return the number of queen pairs that attack each other.
    One queen per row representation: state[r] = column, so each row can have at most one queen.
    Conflicts if two queens are in the same column (col1 == col2), 
    or on the same diagonal if the difference in rows equals the difference in columns (abs(row1 - row2) == abs(col1 - col2))
    """
    conflicts = 0
    for row1 in range(board_size):
        col1 = board[row1]  # column of queen in row1
        for row2 in range(row1 + 1, board_size):
            col2 = board[row2]  # column of queen in row2
            # same column
            if col1 == col2:
                conflicts += 1
            # same diagonal
            if abs(row1 - row2) == abs(col1 - col2):
                conflicts += 1

    return conflicts

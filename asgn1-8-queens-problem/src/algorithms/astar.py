from __future__ import annotations
from typing import List, Tuple, Dict, Optional, Set
import heapq
from src.core.heuristic import attacking_pairs

board_size = 8
Board = List[int]  # board[row] = column of the queen in that row


def neighbors(board: Board) -> List[Board]:
    """Generate neighbors (a list of queen positions) by moving the queen in one row to a different column."""
    try:
        row = next(i for i, c in enumerate(board) if c == -1)
    except StopIteration:
        row = None
    # Empty list that store all the neighbor states
    neighbors: List[Board] = []
    if row is not None:
        for col in range(board_size):
            neighbor = board.copy()
            neighbor[row] = col
            neighbors.append(neighbor)
    else:
        for row in range(board_size):
            current_col = board[row]
            for col in range(board_size):
                if col == current_col:
                    continue
                neighbor = board.copy()
                neighbor[row] = col
                neighbors.append(neighbor)

    return neighbors


def reconstruct_path(parent: Dict[Tuple[int, ...], Tuple[int, ...]],
                     goal: Tuple[int, ...]) -> List[Board]:
    """ Rebuild the sequence from start to goal using the parent dictionary."""
    path: List[Board] = []
    current = goal
    while current in parent:
        path.append(list(current))
        current = parent[current]
    path.append(list(current))  # add the start state
    path.reverse()
    return path


def a_star(initial: Board, max_expansions: int = 100000) -> Tuple[Optional[List[Board]], int]:
    """
    A* search for the N-Queens problem 

    The evaluation function would be: f = g + h. 
    - g = cost so far (number of moves made from the start board, each move costs 1)
    - h = heuristic, the number of attacking queen pairs in the current board.

    Goal: a board where attacking_pairs(board) == 0

    Return values:
    - (solution_board, expansions (total states expanded)) if a solution is found
    - (None, expansions) if no solution is found within max_expansions
    """
    start = tuple(initial)

    def is_goal(board: Board) -> bool:
        return all(c >= 0 for c in board) and attacking_pairs(board) == 0

    # early exit if initial state is already a goal
    if is_goal(start):
        return [initial], 0

    # The priority queue (min-heap) for the frontier
    # Each entry is a tuple (f = g + h, g = cost so far, board as a tuple)
    frontier: List[Tuple[int, int, Tuple[int, ...]]] = []
    heuristic_start = attacking_pairs(initial)
    heapq.heappush(frontier, (heuristic_start, 0, start))

    parent: Dict[Tuple[int, ...], Tuple[int, ...]] = {}
    g_cost: Dict[Tuple[int, ...], int] = {start: 0}
    closed: Set[Tuple[int, ...]] = set()

    expansions = 0

    while frontier and expansions < max_expansions:
        f, g, cur = heapq.heappop(frontier)
        if cur in closed:
            continue
        closed.add(cur)

        cur_list = list(cur)
        if attacking_pairs(cur_list) == 0:
            path = reconstruct_path(parent, cur)
            return path, expansions

        expansions += 1

        for neighbor in neighbors(cur_list):
            neighbor_tuple = tuple(neighbor)
            tentative_g = g + 1
            if neighbor_tuple in closed and tentative_g >= g_cost.get(neighbor_tuple, float("inf")):
                continue
            if tentative_g < g_cost.get(neighbor_tuple, float("inf")):
                parent[neighbor_tuple] = cur
                g_cost[neighbor_tuple] = tentative_g
                h = attacking_pairs(neighbor)
                heapq.heappush(frontier, (tentative_g + h,
                               tentative_g, neighbor_tuple))

    return None, expansions

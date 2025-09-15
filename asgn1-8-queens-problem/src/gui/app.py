import tkinter as tk
from tkinter import messagebox
from typing import List, Tuple, Optional
from PIL import Image, ImageTk, Image

from src.core.heuristic import attacking_pairs
from src.algorithms.astar import a_star

board_size = 8
cell_size = 60
padding = 12


# ----------------------------- A* (row-level, compact) ------------------------
def steps_from_astar(start_state: List[int]) -> List[dict]:
    path, *_ = a_star(start_state)  # accept either 2-tuple or 3-tuple
    if not path:
        return [{
            "type": "error", "state": start_state.copy(), "row": -1, "col": -1,
            "h": attacking_pairs(start_state)
        }]

    n = len(path[0])
    shown = path[0].copy()  # show initial state fully
    steps: List[dict] = []

    steps.append({"type": "start", "state": shown.copy(), "row": -1, "col": -1,
                  "h": attacking_pairs(path[0])})

    for i in range(1, len(path)):
        prev_board, cur_board = path[i - 1], path[i]
        diffs = [r for r in range(n) if cur_board[r] != prev_board[r]]
        if not diffs:
            continue
        for r in diffs:
            shown[r] = cur_board[r]
            steps.append({
                "type": "move",
                "state": shown.copy(),
                "row": r,
                "col": cur_board[r],
                "h": attacking_pairs(cur_board),
            })

    steps.append({"type": "done", "state": shown.copy(),
                 "row": -1, "col": -1, "h": 0})
    return steps


# ----------------------------- A* (per-cell, detailed) ------------------------
def steps_from_astar_per_cell(start_state: List[int]) -> List[dict]:
    # Use the path returned by a_star, ignore any extra returns safely
    result = a_star(start_state)
    path = result[0] if result else []

    if not path:
        return [{
            "type": "error", "state": start_state.copy(), "row": -1, "col": -1,
            "h": attacking_pairs(start_state)
        }]

    n = len(path[0])
    shown = path[0].copy()
    steps: List[dict] = []
    steps.append({"type": "start", "state": shown.copy(), "row": -1, "col": -1,
                  "h": attacking_pairs(path[0])})

    for i in range(1, len(path)):
        prev_board, cur_board = path[i - 1], path[i]
        diffs = [row for row in range(n) if cur_board[row] != prev_board[row]]
        if not diffs:
            continue

        for row in diffs:
            target_col = cur_board[row]
            # sweep previews across the row
            for col in range(n):
                temp = shown.copy()
                temp[row] = col
                steps.append({
                    "type": "discover",
                    "state": temp,
                    "row": row,
                    "col": col,
                    "h": attacking_pairs(cur_board),
                    "g": None,
                    "f": None,
                })
            # commit
            shown[row] = target_col
            steps.append({
                "type": "expand",
                "state": shown.copy(),
                "row": row,
                "col": target_col,
                "h": attacking_pairs(cur_board),
                "g": None,
                "f": None,
            })

    steps.append({"type": "done", "state": shown.copy(),
                 "row": -1, "col": -1, "h": 0})
    return steps


# ----------------------------- Backtracking (verbose) -------------------------
def steps_from_backtracking(start_state: List[int]) -> List[dict]:
    """
    start_state may contain -1 for empty rows.
    Honors fixed queens, fills the rest. Logs try/place/conflict/backtrack/done.
    """
    n = len(start_state)
    board = start_state.copy()
    steps: List[dict] = []

    def is_safe(rows: int, cols: int) -> bool:
        if cols == -1:
            return False
        for row in range(n):
            col = board[row]
            if row == rows:
                continue  # skip the same row
            if col == -1:
                continue
            if cols == col:
                return False  # same column
            if abs(rows - row) == abs(cols - col):
                return False  # same diagonal
        return True

    # validate pre-placed queens
    for row in range(n):
        col = board[row]
        if col != -1 and not is_safe(row, col):
            steps.append({"type": "error", "state": board.copy(), "row": row, "col": col,
                          "h": attacking_pairs(board)})
            return steps

    steps.append({"type": "start", "state": board.copy(), "row": -1, "col": -1,
                  "h": attacking_pairs(board)})

    def next_empty_row(from_row: int) -> int:
        for rr in range(from_row, n):
            if board[rr] == -1:
                return rr
        return n

    def place_from(row_index: int) -> bool:
        row = next_empty_row(row_index)
        if row >= n:
            steps.append({"type": "done", "state": board.copy(),
                         "row": -1, "col": -1, "h": 0})
            return True

        for col in range(n):
            steps.append({"type": "try", "state": board.copy(), "row": row, "col": col,
                          "h": attacking_pairs(board)})
            if is_safe(row, col):
                board[row] = col
                steps.append({"type": "place", "state": board.copy(), "row": row, "col": col,
                              "h": attacking_pairs(board)})
                if place_from(row + 1):
                    return True
                board[row] = -1
                steps.append({"type": "backtrack", "state": board.copy(), "row": row, "col": col,
                              "h": attacking_pairs(board)})
            else:
                steps.append({"type": "conflict", "state": board.copy(), "row": row, "col": col,
                              "h": attacking_pairs(board)})
        return False

    place_from(0)
    return steps


# ------------------------ Backtracking (row-level, compact) -------------------
def steps_from_backtracking_compact(start_state: List[int]) -> List[dict]:
    verbose = steps_from_backtracking(start_state)
    if not verbose:
        return verbose
    steps = [verbose[0]]  # keep 'start'
    for s in verbose[1:]:
        if s["type"] in ("place", "backtrack", "done", "error"):
            steps.append(s)
    return steps


# ==============================================================================

class QueensGUI:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("8-Queens, A* vs Backtracking")

        # animation state
        self.steps: List[dict] = []
        self.current_step_index = 0
        self.is_playing = False
        self.speed_ms = 150
        self.timer_id = None

        # edit state
        self.mode = "edit"  # "edit" or "play"
        self.user_start_state = [-1] * board_size
        self.conflict_rows = set()  # for Check Answer highlights

        # solver mode: "astar" or "backtrack"
        self.solver_mode = tk.StringVar(value="astar")  # default to A*
        # used as a generic "trace" toggle for both solvers
        self.use_astar_trace = tk.BooleanVar(value=False)

        # images
        img = Image.open("assets/icons/queen.png").resize((cell_size - 10, cell_size - 10),
                                                          Image.Resampling.LANCZOS)
        self.queen_icon = ImageTk.PhotoImage(img)
        self.overlay_img = None

        # canvas
        canvas_w = board_size * cell_size + 2 * padding
        canvas_h = board_size * cell_size + 2 * padding
        self.canvas = tk.Canvas(root, width=canvas_w, height=canvas_h)
        self.canvas.grid(row=0, column=0, columnspan=8, padx=8, pady=8)
        self.canvas.bind("<Button-1>", self.on_canvas_click)

        # controls row 1
        self.btn_prev = tk.Button(root, text="Back", command=self.prev_step)
        self.btn_next = tk.Button(root, text="Next", command=self.next_step)
        self.btn_play = tk.Button(root, text="Play", command=self.toggle_play)
        self.btn_clear = tk.Button(
            root, text="Clear", command=self.clear_board)
        self.btn_run = tk.Button(
            root, text="Run", command=self.run_from_board, state="disabled")
        self.btn_restart = tk.Button(
            root, text="Restart", command=self.restart)
        self.speed_scale = tk.Scale(root, from_=50, to=1200, orient=tk.HORIZONTAL,
                                    label="Speed (ms)", command=self.on_speed)
        self.speed_scale.set(self.speed_ms)
        self.btn_check = tk.Button(
            root, text="Check Answer", command=self.check_answer)

        self.btn_prev.grid(row=1, column=0, sticky="ew", padx=4, pady=(0, 8))
        self.btn_next.grid(row=1, column=1, sticky="ew", padx=4, pady=(0, 8))
        self.btn_play.grid(row=1, column=2, sticky="ew", padx=4, pady=(0, 8))
        self.btn_clear.grid(row=1, column=3, sticky="ew", padx=4, pady=(0, 8))
        self.btn_run.grid(row=1, column=4, sticky="ew", padx=4, pady=(0, 8))
        self.btn_restart.grid(
            row=1, column=5, sticky="ew", padx=4, pady=(0, 8))
        self.speed_scale.grid(
            row=1, column=6, sticky="ew", padx=4, pady=(0, 8))
        self.btn_check.grid(row=1, column=7, sticky="ew", padx=4, pady=(0, 8))

        # controls row 2, solver toggle
        self.radio_astar = tk.Radiobutton(root, text="A* Search", variable=self.solver_mode, value="astar",
                                          command=self.on_solver_mode_change)
        self.chk_trace = tk.Checkbutton(root, text="Show detailed steps", variable=self.use_astar_trace,
                                        command=self.on_trace_toggle)
        self.radio_back = tk.Radiobutton(root, text="Backtracking", variable=self.solver_mode, value="backtrack",
                                         command=self.on_solver_mode_change)

        self.radio_astar.grid(
            row=2, column=0, columnspan=2, sticky="w", padx=8)
        self.chk_trace.grid(row=2, column=2, sticky="w", padx=8)
        self.radio_back.grid(row=2, column=3, columnspan=2, sticky="w", padx=8)

        # info
        self.lbl_info = tk.Label(root, text="", anchor="w")
        self.lbl_info.grid(row=3, column=0, columnspan=8, sticky="ew", padx=8)

        self.update_run_button_state()
        self.draw()

    # ----------------------------- helpers ------------------------------------
    def canvas_to_board(self, x: int, y: int) -> Tuple[Optional[int], Optional[int]]:
        if x < padding or y < padding:
            return (None, None)
        col = (x - padding) // cell_size
        row = (y - padding) // cell_size
        if 0 <= row < board_size and 0 <= col < board_size:
            return int(row), int(col)
        return (None, None)

    def update_run_button_state(self):
        """Enable Run for both solvers regardless of placement."""
        self.btn_run.config(state="normal")

    # ------------------------------ toggles -----------------------------------
    def on_solver_mode_change(self):
        # keep trace toggle enabled for both modes
        self.chk_trace.config(state="normal")

        if self.mode == "play":
            state = self.user_start_state.copy()
            if self.solver_mode.get() == "astar":
                self.steps = steps_from_astar_per_cell(
                    state) if self.use_astar_trace.get() else steps_from_astar(state)
            else:
                # verbose if trace ON, compact if OFF
                self.steps = steps_from_backtracking(state) if self.use_astar_trace.get(
                ) else steps_from_backtracking_compact(state)
            self.current_step_index = 0
            self.is_playing = False
            self.btn_play.config(text="Play")

        self.update_run_button_state()
        self.draw()

    def on_trace_toggle(self):
        if self.mode != "play":
            self.draw()
            return

        state = self.user_start_state.copy()
        if self.solver_mode.get() == "astar":
            self.steps = steps_from_astar_per_cell(
                state) if self.use_astar_trace.get() else steps_from_astar(state)
        else:
            self.steps = steps_from_backtracking(state) if self.use_astar_trace.get(
            ) else steps_from_backtracking_compact(state)

        self.current_step_index = 0
        self.is_playing = False
        self.btn_play.config(text="Play")
        self.draw()

    # ------------------------------ events ------------------------------------
    def on_canvas_click(self, event):
        if self.mode != "edit":
            return
        row, col = self.canvas_to_board(event.x, event.y)
        if row is None:
            return
        # toggle queen placement for this row
        self.user_start_state[row] = - \
            1 if self.user_start_state[row] == col else col
        self.update_run_button_state()
        self.draw()

    # ----------------------------- controls -----------------------------------
    def clear_board(self):
        self.mode = "edit"
        self.user_start_state = [-1] * board_size
        self.stop_timer()
        self.current_step_index = 0
        self.is_playing = False
        self.btn_play.config(text="Play")
        self.conflict_rows = set()
        self.update_run_button_state()
        self.draw()

    def run_from_board(self):
        # clear edit-mode highlights
        self.conflict_rows = set()
        state = self.user_start_state.copy()

        if self.solver_mode.get() == "astar":
            self.steps = steps_from_astar_per_cell(
                state) if self.use_astar_trace.get() else steps_from_astar(state)
        else:
            self.steps = steps_from_backtracking(state) if self.use_astar_trace.get(
            ) else steps_from_backtracking_compact(state)

        self.mode = "play"
        self.current_step_index = 0
        self.is_playing = False
        self.btn_play.config(text="Play")
        self.draw()

    def restart(self):
        self.stop_timer()
        self.mode = "edit"
        self.current_step_index = 0
        self.is_playing = False
        self.btn_play.config(text="Play")
        self.conflict_rows = set()
        self.update_run_button_state()
        self.draw()

    def on_speed(self, val):
        try:
            self.speed_ms = int(val)
        except ValueError:
            pass

    def toggle_play(self):
        if self.mode != "play":
            return
        self.is_playing = not self.is_playing
        self.btn_play.config(text="Pause" if self.is_playing else "Play")
        if self.is_playing:
            self.tick()

    def stop_timer(self):
        if self.timer_id is not None:
            self.root.after_cancel(self.timer_id)
            self.timer_id = None

    def tick(self):
        if not self.is_playing or self.mode != "play":
            return
        if self.current_step_index < len(self.steps) - 1:
            self.current_step_index += 1
            self.draw()
            self.timer_id = self.root.after(self.speed_ms, self.tick)
        else:
            self.is_playing = False
            self.btn_play.config(text="Play")

    def next_step(self):
        if self.mode != "play":
            return
        self.stop_timer()
        self.is_playing = False
        self.btn_play.config(text="Play")
        if self.current_step_index < len(self.steps) - 1:
            self.current_step_index += 1
            self.draw()

    def prev_step(self):
        if self.mode != "play":
            return
        self.stop_timer()
        self.is_playing = False
        self.btn_play.config(text="Play")
        if self.current_step_index > 0:
            self.current_step_index -= 1
            self.draw()

    # --------------------- check answer / conflicts ----------------------------
    def find_conflict_rows(self, state: List[int]) -> set:
        """Return a set of row indices whose queens are in conflict."""
        rows = set()
        n = len(state)
        for row1 in range(n):
            col1 = state[row1]
            if col1 < 0:
                continue
            for row2 in range(row1 + 1, n):
                col2 = state[row2]
                if col2 < 0:
                    continue
                if col1 == col2 or abs(row1 - row2) == abs(col1 - col2):
                    rows.add(row1)
                    rows.add(row2)
        return rows

    def check_answer(self):
        if self.mode != "edit":
            messagebox.showinfo("Info", "You can check only in Edit mode.")
            return

        state = self.user_start_state
        if not all(state[row] >= 0 for row in range(board_size)):
            missing = sum(1 for row in range(board_size) if state[row] < 0)
            messagebox.showwarning(
                "Incomplete", f"Place one queen in every row first. Missing rows: {missing}.")
            self.conflict_rows = set()
            self.draw()
            return

        conflicts = attacking_pairs(state)
        if conflicts == 0:
            self.conflict_rows = set()
            messagebox.showinfo(
                "Correct", "Nice, no queens attack each other!")
        else:
            self.conflict_rows = self.find_conflict_rows(state)
            messagebox.showerror(
                "Not yet", f"{conflicts} attacking pair(s) detected. Conflicting rows are highlighted.")
        self.draw()

    # -------------------------------- draw ------------------------------------
    def draw(self):
        self.canvas.delete("all")

        if self.mode == "edit":
            board_state = self.user_start_state
            active_row = -1
            active_col = -1
            action_type = "edit"
        else:
            step = self.steps[self.current_step_index]
            board_state = step["state"]
            active_row = step["row"]
            active_col = step["col"]
            action_type = step["type"]

        # board
        for row in range(board_size):
            for col in range(board_size):
                x = padding + col * cell_size
                y = padding + row * cell_size
                fill = "#EEE" if (row + col) % 2 == 0 else "#AAA"
                self.canvas.create_rectangle(
                    x, y, x + cell_size, y + cell_size, fill=fill, outline="#555")

        # highlight active row during play
        if self.mode == "play" and 0 <= active_row < board_size:
            overlay_img = Image.new(
                "RGBA", (board_size * cell_size, cell_size), (255, 141, 161, 128))
            self.overlay_img = ImageTk.PhotoImage(overlay_img)
            y0 = padding + active_row * cell_size
            self.canvas.create_image(
                padding, y0, anchor="nw", image=self.overlay_img)

        # marker for the current candidate or commit step
        marker_types = ("try", "conflict", "discover", "expand")
        skip_cell = None
        if (
            self.mode == "play"
            and 0 <= active_row < board_size
            and 0 <= active_col < board_size
            and action_type in marker_types
        ):
            if action_type == "discover":
                # hide queen under marker to avoid double-draw
                skip_cell = (active_row, active_col)
            x = padding + active_col * cell_size + cell_size // 2
            y = padding + active_row * cell_size + cell_size // 2
            self.canvas.create_image(x, y, image=self.queen_icon)

        # queens
        for row in range(board_size):
            col = board_state[row]
            if col >= 0 and (skip_cell is None or (row, col) != skip_cell):
                x_center = padding + col * cell_size + cell_size // 2
                y_center = padding + row * cell_size + cell_size // 2
                self.canvas.create_image(
                    x_center, y_center, image=self.queen_icon)

                # conflict outline in edit mode
                if self.mode == "edit" and row in self.conflict_rows:
                    x0 = padding + col * cell_size
                    y0 = padding + row * cell_size
                    self.canvas.create_rectangle(x0, y0, x0 + cell_size, y0 + cell_size,
                                                 outline="#ff3b30", width=3)

        # info + button states
        if self.mode == "edit":
            placed = sum(1 for v in self.user_start_state if v >= 0)
            mode_label = "A*" if self.solver_mode.get() == "astar" else "Backtracking"
            extra = " (needs all 8 placed)" if self.solver_mode.get(
            ) == "astar" else " (can start anytime)"
            self.lbl_info.config(
                text=f"Click on the board to place queens, one per row. Or choose a solving mode: A* or Backtracking. Placed: {placed}/{board_size} \nNote: Queens are considered 'attacking' if they share the same row, same column, or on the same diagonal."
            )
            self.btn_prev.config(state="disabled")
            self.btn_next.config(state="disabled")
            self.btn_play.config(state="disabled")
            self.btn_check.config(state="normal")
        else:
            labels = {
                "start": "Start", "discover": "Discover", "expand": "Expand", "move": "Move",
                "try": "Try", "conflict": "Conflict", "backtrack": "Backtrack", "done": "Done"
            }
            g = self.steps[self.current_step_index].get("g")
            h = self.steps[self.current_step_index].get("h")
            f = self.steps[self.current_step_index].get("f")
            extra = f"   f={f} g={g} h={h}" if f is not None else (
                f"   h={h}" if h is not None else "")
            self.lbl_info.config(
                text=f"Step {self.current_step_index + 1}/{len(self.steps)}  Action: {labels.get(action_type, action_type)} "
                f"at row {active_row}, col {active_col}   State: {board_state}{extra}"
            )
            self.btn_prev.config(
                state=("normal" if self.current_step_index > 0 else "disabled"))
            self.btn_next.config(state=(
                "normal" if self.current_step_index < len(self.steps) - 1 else "disabled"))
            self.btn_play.config(state="normal")
            self.btn_check.config(state="disabled")


def main():
    root = tk.Tk()
    app = QueensGUI(root)
    root.mainloop()


if __name__ == "__main__":
    main()

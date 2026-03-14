#!/usr/bin/env python3
import sys
import json
import signal
import chess

PIECE_VALUES = {chess.PAWN: 1, chess.KNIGHT: 3.25, chess.BISHOP: 3.33, chess.ROOK: 5.1, chess.QUEEN: 9.4, chess.KING: 0}
PIECE_NAMES = {chess.PAWN: "Pawn", chess.KNIGHT: "Knight", chess.BISHOP: "Bishop", chess.ROOK: "Rook", chess.QUEEN: "Queen", chess.KING: "King"}
KAUFMAN_VALUES = {chess.PAWN: 1, chess.KNIGHT: 3.25, chess.BISHOP: 3.33, chess.ROOK: 5.1, chess.QUEEN: 9.4, chess.KING: 0}
CENTER_SQUARES = [chess.D4, chess.D5, chess.E4, chess.E5]
FILES = "abcdefgh"
STARTING_SQUARES = {
    chess.WHITE: {
        chess.PAWN: [chess.A2, chess.B2, chess.C2, chess.D2, chess.E2, chess.F2, chess.G2, chess.H2],
        chess.KNIGHT: [chess.B1, chess.G1],
        chess.BISHOP: [chess.C1, chess.F1],
        chess.ROOK: [chess.A1, chess.H1],
        chess.QUEEN: [chess.D1],
        chess.KING: [chess.E1],
    },
    chess.BLACK: {
        chess.PAWN: [chess.A7, chess.B7, chess.C7, chess.D7, chess.E7, chess.F7, chess.G7, chess.H7],
        chess.KNIGHT: [chess.B8, chess.G8],
        chess.BISHOP: [chess.C8, chess.F8],
        chess.ROOK: [chess.A8, chess.H8],
        chess.QUEEN: [chess.D8],
        chess.KING: [chess.E8],
    },
}

def side_name(color):
    return "White" if color == chess.WHITE else "Black"

def sq_name(sq):
    return chess.square_name(sq)

def piece_label(pt):
    return PIECE_NAMES.get(pt, "?")

def piece_value(pt):
    return PIECE_VALUES.get(pt, 0)

def is_square_light(sq):
    return (chess.square_file(sq) + chess.square_rank(sq)) % 2 == 1

def see(board, sq):
    attacker_sq = board.attackers(not board.piece_at(sq).color, sq)
    if not attacker_sq:
        return 0
    defenders = board.attackers(board.piece_at(sq).color, sq)
    target_val = piece_value(board.piece_at(sq).piece_type)

    att_vals = sorted([piece_value(board.piece_at(a).piece_type) for a in attacker_sq])
    def_vals = sorted([piece_value(board.piece_at(d).piece_type) for d in defenders])

    gain = [0] * 32
    gain[0] = target_val
    d = 0
    side_is_attacker = True
    a_idx = 0
    d_idx = 0

    while True:
        d += 1
        if side_is_attacker:
            if a_idx >= len(att_vals):
                break
            gain[d] = -gain[d - 1] + (att_vals[a_idx] if not side_is_attacker else (def_vals[d_idx] if d_idx < len(def_vals) else 0))
            a_idx += 1
        else:
            if d_idx >= len(def_vals):
                break
            d_idx += 1

        side_is_attacker = not side_is_attacker
        if d > 20:
            break

    result = att_vals[0] if att_vals else 0
    return target_val - result if len(def_vals) == 0 else min(target_val, target_val - (def_vals[0] if def_vals else 0))


def simple_see(board, target_sq, attacker_color):
    target_piece = board.piece_at(target_sq)
    if not target_piece:
        return 0

    attackers = sorted(
        [piece_value(board.piece_at(s).piece_type) for s in board.attackers(attacker_color, target_sq)],
    )
    defenders = sorted(
        [piece_value(board.piece_at(s).piece_type) for s in board.attackers(not attacker_color, target_sq)],
    )

    if not attackers:
        return 0

    target_val = piece_value(target_piece.piece_type)
    gain = [0] * 33
    gain[0] = target_val
    current_piece_val = attackers[0]
    ai = 1
    di = 0
    d = 1
    is_attacker_turn = False

    while True:
        if is_attacker_turn:
            if ai >= len(attackers):
                break
            gain[d] = current_piece_val - gain[d - 1]
            current_piece_val = attackers[ai]
            ai += 1
        else:
            if di >= len(defenders):
                break
            gain[d] = current_piece_val - gain[d - 1]
            current_piece_val = defenders[di]
            di += 1
        if max(gain[d], -gain[d]) == 0:
            break
        d += 1
        is_attacker_turn = not is_attacker_turn
        if d > 30:
            break

    while d > 0:
        d -= 1
        gain[d] = -max(-gain[d], gain[d + 1])

    return gain[0]


def detect_hanging_pieces(board):
    results = []
    for sq in chess.SQUARES:
        piece = board.piece_at(sq)
        if not piece or piece.piece_type == chess.KING:
            continue
        color = piece.color
        enemy = not color
        attackers = list(board.attackers(enemy, sq))
        if not attackers:
            continue
        defenders = list(board.attackers(color, sq))
        if not defenders:
            results.append({
                "type": "hanging_piece",
                "side": side_name(color),
                "description": f"{side_name(color)}'s {piece_label(piece.piece_type)} on {sq_name(sq)} is undefended and attacked.",
                "squares": [sq_name(sq)],
            })
            continue
        min_attacker_val = min(piece_value(board.piece_at(a).piece_type) for a in attackers)
        piece_val = piece_value(piece.piece_type)
        if min_attacker_val < piece_val:
            results.append({
                "type": "hanging_piece",
                "side": side_name(color),
                "description": f"{side_name(color)}'s {piece_label(piece.piece_type)} on {sq_name(sq)} is attacked by a lower-value piece.",
                "squares": [sq_name(sq)],
            })
    return results


def detect_forks(board):
    results = []
    for sq in chess.SQUARES:
        piece = board.piece_at(sq)
        if not piece or piece.piece_type == chess.KING:
            continue
        color = piece.color
        enemy = not color
        attacked_sqs = board.attacks(sq)
        valuable_targets = []
        for tsq in attacked_sqs:
            target = board.piece_at(tsq)
            if target and target.color == enemy and target.piece_type != chess.PAWN:
                defenders = list(board.attackers(enemy, tsq))
                target_val = piece_value(target.piece_type)
                attacker_val = piece_value(piece.piece_type)
                if not defenders or attacker_val < target_val:
                    valuable_targets.append((tsq, target))
        if len(valuable_targets) >= 2:
            target_names = [f"{piece_label(t.piece_type)} on {sq_name(s)}" for s, t in valuable_targets]
            results.append({
                "type": "fork",
                "side": side_name(color),
                "description": f"{side_name(color)}'s {piece_label(piece.piece_type)} on {sq_name(sq)} forks {', '.join(target_names)}.",
                "squares": [sq_name(sq)] + [sq_name(s) for s, _ in valuable_targets],
            })
    return results


def detect_pins(board):
    results = []
    for color in [chess.WHITE, chess.BLACK]:
        king_sq = board.king(color)
        if king_sq is None:
            continue
        for sq in chess.SQUARES:
            piece = board.piece_at(sq)
            if not piece or piece.color != color or piece.piece_type == chess.KING:
                continue
            if board.is_pinned(color, sq):
                pin_mask = board.pin(color, sq)
                pinner_sq = None
                for psq in chess.SQUARES:
                    pp = board.piece_at(psq)
                    if pp and pp.color != color and pin_mask & chess.BB_SQUARES[psq] and psq != sq:
                        if pp.piece_type in (chess.BISHOP, chess.ROOK, chess.QUEEN):
                            pinner_sq = psq
                            break
                if pinner_sq is not None:
                    pinner = board.piece_at(pinner_sq)
                    results.append({
                        "type": "pin_absolute",
                        "side": side_name(color),
                        "description": f"{side_name(color)}'s {piece_label(piece.piece_type)} on {sq_name(sq)} is pinned to the King by {side_name(not color)}'s {piece_label(pinner.piece_type)} on {sq_name(pinner_sq)}.",
                        "squares": [sq_name(sq), sq_name(pinner_sq), sq_name(king_sq)],
                    })
    return results


def detect_pin_relative(board):
    results = []
    for color in [chess.WHITE, chess.BLACK]:
        enemy = not color
        for sq in chess.SQUARES:
            piece = board.piece_at(sq)
            if not piece or piece.color != color or piece.piece_type in (chess.KING, chess.PAWN):
                continue
            for attacker_sq in chess.SQUARES:
                att = board.piece_at(attacker_sq)
                if not att or att.color != enemy:
                    continue
                if att.piece_type not in (chess.BISHOP, chess.ROOK, chess.QUEEN):
                    continue
                attacks = board.attacks(attacker_sq)
                if sq not in attacks:
                    continue
                af, ar_ = chess.square_file(attacker_sq), chess.square_rank(attacker_sq)
                pf, pr_ = chess.square_file(sq), chess.square_rank(sq)
                df = pf - af
                dr = pr_ - ar_
                if df == 0:
                    direction = (0, 1 if dr > 0 else -1)
                elif dr == 0:
                    direction = (1 if df > 0 else -1, 0)
                elif abs(df) == abs(dr):
                    direction = (1 if df > 0 else -1, 1 if dr > 0 else -1)
                else:
                    continue
                bf, br_ = pf + direction[0], pr_ + direction[1]
                while 0 <= bf <= 7 and 0 <= br_ <= 7:
                    behind_sq = chess.square(bf, br_)
                    behind_piece = board.piece_at(behind_sq)
                    if behind_piece:
                        if (behind_piece.color == color and
                            behind_piece.piece_type != chess.KING and
                            piece_value(behind_piece.piece_type) > piece_value(piece.piece_type)):
                            results.append({
                                "type": "pin_relative",
                                "side": side_name(enemy),
                                "description": f"{side_name(enemy)}'s {piece_label(att.piece_type)} on {sq_name(attacker_sq)} pins {side_name(color)}'s {piece_label(piece.piece_type)} on {sq_name(sq)} to the {piece_label(behind_piece.piece_type)} on {sq_name(behind_sq)}.",
                                "squares": [sq_name(attacker_sq), sq_name(sq), sq_name(behind_sq)],
                            })
                        break
                    bf += direction[0]
                    br_ += direction[1]
    return results


def detect_direct_material_loss(board):
    results = []
    turn = board.turn
    for move in board.legal_moves:
        if not board.is_capture(move):
            continue
        captured = board.piece_at(move.to_square)
        attacker = board.piece_at(move.from_square)
        if not captured or not attacker:
            continue
        board.push(move)
        recapture_value = 0
        for resp in board.legal_moves:
            if resp.to_square == move.to_square:
                resp_attacker = board.piece_at(resp.from_square)
                if resp_attacker:
                    recapture_value = max(recapture_value, piece_value(attacker.piece_type))
        board.pop()
        net_gain = piece_value(captured.piece_type) - recapture_value
        if net_gain >= 2.0:
            results.append({
                "type": "direct_material_loss",
                "side": side_name(not turn),
                "description": f"{side_name(not turn)}'s {piece_label(captured.piece_type)} on {sq_name(move.to_square)} can be captured by {side_name(turn)}'s {piece_label(attacker.piece_type)} for a net gain of ~{net_gain:.0f} points.",
                "squares": [sq_name(move.from_square), sq_name(move.to_square)],
            })
    seen = set()
    deduped = []
    for r in results:
        key = r["squares"][1]
        if key not in seen:
            seen.add(key)
            deduped.append(r)
    return deduped


def detect_skewers(board):
    results = []
    for color in [chess.WHITE, chess.BLACK]:
        enemy = not color
        for sq in chess.SQUARES:
            piece = board.piece_at(sq)
            if not piece or piece.color != color:
                continue
            if piece.piece_type not in (chess.BISHOP, chess.ROOK, chess.QUEEN):
                continue
            attacks = board.attacks(sq)
            for tsq in attacks:
                target = board.piece_at(tsq)
                if not target or target.color != enemy:
                    continue
                direction = None
                tf, tr = chess.square_file(tsq), chess.square_rank(tsq)
                sf, sr = chess.square_file(sq), chess.square_rank(sq)
                df = tf - sf
                dr = tr - sr
                if df == 0:
                    direction = (0, 1 if dr > 0 else -1)
                elif dr == 0:
                    direction = (1 if df > 0 else -1, 0)
                elif abs(df) == abs(dr):
                    direction = (1 if df > 0 else -1, 1 if dr > 0 else -1)
                else:
                    continue
                behind_f, behind_r = tf + direction[0], tr + direction[1]
                while 0 <= behind_f <= 7 and 0 <= behind_r <= 7:
                    behind_sq = chess.square(behind_f, behind_r)
                    behind_piece = board.piece_at(behind_sq)
                    if behind_piece:
                        if behind_piece.color == enemy and piece_value(target.piece_type) > piece_value(behind_piece.piece_type):
                            results.append({
                                "type": "skewer",
                                "side": side_name(color),
                                "description": f"{side_name(color)}'s {piece_label(piece.piece_type)} on {sq_name(sq)} skewers {side_name(enemy)}'s {piece_label(target.piece_type)} on {sq_name(tsq)} to the {piece_label(behind_piece.piece_type)} on {sq_name(behind_sq)}.",
                                "squares": [sq_name(sq), sq_name(tsq), sq_name(behind_sq)],
                            })
                        break
                    behind_f += direction[0]
                    behind_r += direction[1]
    return results


def detect_discovered_attacks(board):
    results = []
    turn = board.turn
    for sq in chess.SQUARES:
        piece = board.piece_at(sq)
        if not piece or piece.color != turn:
            continue
        for move in board.legal_moves:
            if move.from_square != sq:
                continue
            board.push(move)
            for slider_sq in chess.SQUARES:
                slider = board.piece_at(slider_sq)
                if not slider or slider.color != turn:
                    continue
                if slider.piece_type not in (chess.BISHOP, chess.ROOK, chess.QUEEN):
                    continue
                if slider_sq == move.to_square:
                    continue
                new_attacks = board.attacks(slider_sq)
                board.pop()
                old_attacks = board.attacks(slider_sq)
                board.push(move)
                revealed = new_attacks & ~old_attacks
                for rsq in chess.SQUARES:
                    if not (revealed & chess.BB_SQUARES[rsq]):
                        continue
                    victim = board.piece_at(rsq)
                    if victim and victim.color != turn and victim.piece_type != chess.KING:
                        board.pop()
                        results.append({
                            "type": "discovered_attack",
                            "side": side_name(turn),
                            "description": f"Moving {side_name(turn)}'s {piece_label(piece.piece_type)} from {sq_name(sq)} reveals an attack by the {piece_label(slider.piece_type)} on {sq_name(slider_sq)} against {side_name(not turn)}'s {piece_label(victim.piece_type)} on {sq_name(rsq)}.",
                            "squares": [sq_name(sq), sq_name(slider_sq), sq_name(rsq)],
                        })
                        return results
            board.pop()
            break
    return results


def detect_overloaded_defenders(board):
    results = []
    for sq in chess.SQUARES:
        piece = board.piece_at(sq)
        if not piece or piece.piece_type == chess.KING or piece.piece_type == chess.PAWN:
            continue
        color = piece.color
        enemy = not color
        defended_pieces = []
        for dsq in board.attacks(sq):
            dp = board.piece_at(dsq)
            if dp and dp.color == color and dp.piece_type != chess.KING:
                other_defenders = [s for s in board.attackers(color, dsq) if s != sq]
                attackers_on_dsq = list(board.attackers(enemy, dsq))
                if attackers_on_dsq and not other_defenders:
                    defended_pieces.append((dsq, dp))
        if len(defended_pieces) >= 2:
            def_names = [f"{piece_label(d.piece_type)} on {sq_name(s)}" for s, d in defended_pieces]
            results.append({
                "type": "overloaded_defender",
                "side": side_name(color),
                "description": f"{side_name(color)}'s {piece_label(piece.piece_type)} on {sq_name(sq)} is overloaded — sole defender of {', '.join(def_names)}.",
                "squares": [sq_name(sq)] + [sq_name(s) for s, _ in defended_pieces],
            })
    return results


def detect_trapped_pieces(board):
    results = []
    for color in [chess.WHITE, chess.BLACK]:
        mod_fen = board.fen().split()
        mod_fen[1] = "w" if color == chess.WHITE else "b"
        try:
            temp = chess.Board(" ".join(mod_fen))
        except:
            continue
        for sq in chess.SQUARES:
            piece = temp.piece_at(sq)
            if not piece or piece.color != color or piece.piece_type in (chess.KING, chess.PAWN):
                continue
            pval = piece_value(piece.piece_type)
            if pval < 3:
                continue
            if sq in STARTING_SQUARES.get(color, {}).get(piece.piece_type, []):
                continue
            legal_dests = [m.to_square for m in temp.legal_moves if m.from_square == sq]
            if not legal_dests:
                enemy_attackers = list(temp.attackers(not color, sq))
                if enemy_attackers:
                    results.append({
                        "type": "trapped_piece",
                        "side": side_name(color),
                        "description": f"{side_name(color)}'s {piece_label(piece.piece_type)} on {sq_name(sq)} is trapped — no legal moves and under attack.",
                        "squares": [sq_name(sq)],
                    })
                continue
            safe_count = 0
            for dest in legal_dests:
                enemy_attackers = list(temp.attackers(not color, dest))
                if not enemy_attackers:
                    safe_count += 1
                else:
                    min_att_val = min(piece_value(temp.piece_at(a).piece_type) for a in enemy_attackers if temp.piece_at(a))
                    if min_att_val >= pval:
                        safe_count += 1
            if safe_count == 0 and len(legal_dests) <= 2:
                results.append({
                    "type": "trapped_piece",
                    "side": side_name(color),
                    "description": f"{side_name(color)}'s {piece_label(piece.piece_type)} on {sq_name(sq)} is nearly trapped — all {len(legal_dests)} move(s) lead to material loss.",
                    "squares": [sq_name(sq)],
                })
    return results


def detect_mating_threats(board):
    results = []
    for move in board.legal_moves:
        board.push(move)
        if board.is_checkmate():
            board.pop()
            piece = board.piece_at(move.from_square)
            results.append({
                "type": "mating_threat",
                "side": side_name(board.turn),
                "description": f"{side_name(board.turn)} has checkmate in one: {piece_label(piece.piece_type) if piece else '?'} to {sq_name(move.to_square)}.",
                "squares": [sq_name(move.from_square), sq_name(move.to_square)],
            })
            break
        board.pop()
    return results


def get_passed_pawns(board, color):
    pawns = []
    for sq in chess.SQUARES:
        piece = board.piece_at(sq)
        if not piece or piece.piece_type != chess.PAWN or piece.color != color:
            continue
        f = chess.square_file(sq)
        r = chess.square_rank(sq)
        is_passed = True
        for ef in range(max(0, f - 1), min(7, f + 1) + 1):
            for er in range(8):
                esq = chess.square(ef, er)
                ep = board.piece_at(esq)
                if ep and ep.piece_type == chess.PAWN and ep.color != color:
                    if color == chess.WHITE and er > r:
                        is_passed = False
                    elif color == chess.BLACK and er < r:
                        is_passed = False
        if is_passed:
            pawns.append(sq)
    return pawns


def detect_promotion_race(board):
    white_passed = get_passed_pawns(board, chess.WHITE)
    black_passed = get_passed_pawns(board, chess.BLACK)
    w_advanced = [sq for sq in white_passed if chess.square_rank(sq) >= 5]
    b_advanced = [sq for sq in black_passed if chess.square_rank(sq) <= 2]
    if w_advanced and b_advanced:
        return [{
            "type": "promotion_race",
            "side": "Both",
            "description": f"Both sides have advanced passed pawns racing to promote: White on {', '.join(sq_name(s) for s in w_advanced)}, Black on {', '.join(sq_name(s) for s in b_advanced)}.",
            "squares": [sq_name(s) for s in w_advanced + b_advanced],
        }]
    return []


def detect_tactical_refutation(board):
    results = []
    if not board.move_stack:
        return results
    last_move = board.peek()
    moved_piece = board.piece_at(last_move.to_square)
    if not moved_piece:
        return results
    for move in board.legal_moves:
        if move.to_square == last_move.to_square:
            captured = board.piece_at(move.to_square)
            if captured:
                attacker = board.piece_at(move.from_square)
                if attacker and piece_value(attacker.piece_type) <= piece_value(captured.piece_type):
                    results.append({
                        "type": "tactical_refutation",
                        "side": side_name(board.turn),
                        "description": f"{side_name(board.turn)} can capture the {piece_label(captured.piece_type)} on {sq_name(move.to_square)} with the {piece_label(attacker.piece_type)} — refuting the last move.",
                        "squares": [sq_name(move.from_square), sq_name(move.to_square)],
                    })
                    return results

    dest_sq = last_move.to_square
    attacks_from_dest = board.attacks(dest_sq)
    attacked_valuable = []
    for tsq in attacks_from_dest:
        target = board.piece_at(tsq)
        if target and target.color == board.turn:
            attacked_valuable.append((tsq, target))
    if len(attacked_valuable) >= 2:
        attacked_valuable.sort(key=lambda x: piece_value(x[1].piece_type), reverse=True)
        t1_sq, t1_p = attacked_valuable[0]
        t2_sq, t2_p = attacked_valuable[1]
        results.append({
            "type": "tactical_refutation",
            "side": side_name(not board.turn),
            "description": f"The last move ({sq_name(last_move.from_square)}-{sq_name(dest_sq)}) created a fork: {side_name(not board.turn)}'s {piece_label(moved_piece.piece_type)} attacks {side_name(board.turn)}'s {piece_label(t1_p.piece_type)} on {sq_name(t1_sq)} and {piece_label(t2_p.piece_type)} on {sq_name(t2_sq)}.",
            "squares": [sq_name(dest_sq), sq_name(t1_sq), sq_name(t2_sq)],
        })
    return results


def detect_development_lead(board):
    results = []
    counts = {chess.WHITE: 0, chess.BLACK: 0, "total_w": 0, "total_b": 0}
    for color in [chess.WHITE, chess.BLACK]:
        for pt in [chess.KNIGHT, chess.BISHOP, chess.ROOK, chess.QUEEN]:
            starting = STARTING_SQUARES[color].get(pt, [])
            for sq in chess.SQUARES:
                piece = board.piece_at(sq)
                if piece and piece.piece_type == pt and piece.color == color:
                    key = "total_w" if color == chess.WHITE else "total_b"
                    counts[key] += 1
                    if sq not in starting:
                        counts[color] += 1
    diff = counts[chess.WHITE] - counts[chess.BLACK]
    if abs(diff) >= 2:
        leader = "White" if diff > 0 else "Black"
        results.append({
            "type": "development_lead",
            "white_developed": counts[chess.WHITE],
            "black_developed": counts[chess.BLACK],
            "description": f"{leader} has a significant development lead ({counts[chess.WHITE]} vs {counts[chess.BLACK]} developed pieces).",
        })
    return results


def detect_center_control(board):
    white_control = 0
    black_control = 0
    details = {}
    for sq in CENTER_SQUARES:
        w_att = len(list(board.attackers(chess.WHITE, sq)))
        b_att = len(list(board.attackers(chess.BLACK, sq)))
        p = board.piece_at(sq)
        if p and p.color == chess.WHITE:
            w_att += 1
        elif p and p.color == chess.BLACK:
            b_att += 1
        white_control += w_att
        black_control += b_att
        details[sq_name(sq)] = {"white": w_att, "black": b_att}

    diff = white_control - black_control
    if abs(diff) >= 3:
        leader = "White" if diff > 0 else "Black"
        desc = f"{leader} dominates the center ({white_control} vs {black_control} control points on d4/d5/e4/e5)."
    elif abs(diff) >= 1:
        leader = "White" if diff > 0 else "Black"
        desc = f"{leader} has a slight center advantage ({white_control} vs {black_control})."
    else:
        desc = f"Center control is balanced ({white_control} vs {black_control})."
    return {
        "type": "center_control",
        "white_control": white_control,
        "black_control": black_control,
        "details": details,
        "description": desc,
    }


def detect_rook_placement(board):
    results = []
    for color in [chess.WHITE, chess.BLACK]:
        for sq in chess.SQUARES:
            piece = board.piece_at(sq)
            if not piece or piece.piece_type != chess.ROOK or piece.color != color:
                continue
            f = chess.square_file(sq)
            has_own_pawn = False
            has_enemy_pawn = False
            for r in range(8):
                psq = chess.square(f, r)
                pp = board.piece_at(psq)
                if pp and pp.piece_type == chess.PAWN:
                    if pp.color == color:
                        has_own_pawn = True
                    else:
                        has_enemy_pawn = True
            if not has_own_pawn and not has_enemy_pawn:
                results.append({
                    "type": "rook_open_file",
                    "side": side_name(color),
                    "description": f"{side_name(color)}'s Rook on {sq_name(sq)} is on an open file.",
                    "squares": [sq_name(sq)],
                })
            elif not has_own_pawn and has_enemy_pawn:
                results.append({
                    "type": "rook_semiopen_file",
                    "side": side_name(color),
                    "description": f"{side_name(color)}'s Rook on {sq_name(sq)} is on a semi-open file.",
                    "squares": [sq_name(sq)],
                })
    return results


def detect_piece_activity(board):
    results = []
    for color in [chess.WHITE, chess.BLACK]:
        mod_fen = board.fen().split()
        mod_fen[1] = "w" if color == chess.WHITE else "b"
        try:
            temp = chess.Board(" ".join(mod_fen))
        except:
            continue
        for sq in chess.SQUARES:
            piece = temp.piece_at(sq)
            if not piece or piece.color != color or piece.piece_type in (chess.KING, chess.PAWN):
                continue
            moves = [m for m in temp.legal_moves if m.from_square == sq]
            if len(moves) <= 1 and piece_value(piece.piece_type) >= 3:
                results.append({
                    "type": "piece_activity",
                    "side": side_name(color),
                    "description": f"{side_name(color)}'s {piece_label(piece.piece_type)} on {sq_name(sq)} is passive ({len(moves)} legal move{'s' if len(moves) != 1 else ''}).",
                    "squares": [sq_name(sq)],
                    "moves": len(moves),
                })
    return results


def detect_outposts(board):
    results = []
    for color in [chess.WHITE, chess.BLACK]:
        enemy = not color
        for sq in chess.SQUARES:
            r = chess.square_rank(sq)
            if color == chess.WHITE and r < 4:
                continue
            if color == chess.BLACK and r > 3:
                continue
            f = chess.square_file(sq)
            can_be_attacked_by_pawn = False
            for ef in [f - 1, f + 1]:
                if 0 <= ef <= 7:
                    if color == chess.WHITE:
                        for er in range(r + 1, 8):
                            esq = chess.square(ef, er)
                            ep = board.piece_at(esq)
                            if ep and ep.piece_type == chess.PAWN and ep.color == enemy:
                                can_be_attacked_by_pawn = True
                                break
                    else:
                        for er in range(0, r):
                            esq = chess.square(ef, er)
                            ep = board.piece_at(esq)
                            if ep and ep.piece_type == chess.PAWN and ep.color == enemy:
                                can_be_attacked_by_pawn = True
                                break
                if can_be_attacked_by_pawn:
                    break
            if not can_be_attacked_by_pawn:
                occupant = board.piece_at(sq)
                if occupant and occupant.color == color and occupant.piece_type in (chess.KNIGHT, chess.BISHOP):
                    results.append({
                        "type": "outpost",
                        "side": side_name(color),
                        "description": f"{side_name(color)}'s {piece_label(occupant.piece_type)} on {sq_name(sq)} occupies a strong outpost (cannot be challenged by enemy pawns).",
                        "squares": [sq_name(sq)],
                    })
                elif not occupant or (occupant and occupant.color != color):
                    for piece_sq in chess.SQUARES:
                        p = board.piece_at(piece_sq)
                        if p and p.color == color and p.piece_type in (chess.KNIGHT, chess.BISHOP):
                            if sq in board.attacks(piece_sq):
                                results.append({
                                    "type": "outpost",
                                    "side": side_name(color),
                                    "description": f"{sq_name(sq)} is a reachable outpost for {side_name(color)}'s {piece_label(p.piece_type)} on {sq_name(piece_sq)} (cannot be challenged by enemy pawns).",
                                    "squares": [sq_name(piece_sq), sq_name(sq)],
                                })
                                break
    return results


def detect_weak_squares(board):
    results = []
    for color in [chess.WHITE, chess.BLACK]:
        weak = []
        important_ranks = range(0, 4) if color == chess.WHITE else range(4, 8)
        for sq in chess.SQUARES:
            r = chess.square_rank(sq)
            if r not in important_ranks:
                continue
            f = chess.square_file(sq)
            defended_by_pawn = False
            for ef in [f - 1, f + 1]:
                if 0 <= ef <= 7:
                    if color == chess.WHITE:
                        dsq = chess.square(ef, r - 1) if r > 0 else None
                    else:
                        dsq = chess.square(ef, r + 1) if r < 7 else None
                    if dsq is not None:
                        dp = board.piece_at(dsq)
                        if dp and dp.piece_type == chess.PAWN and dp.color == color:
                            defended_by_pawn = True
                            break
                    can_advance = False
                    if color == chess.WHITE:
                        for er in range(1, r):
                            esq = chess.square(ef, er)
                            ep = board.piece_at(esq)
                            if ep and ep.piece_type == chess.PAWN and ep.color == color:
                                can_advance = True
                                break
                    else:
                        for er in range(r + 1, 7):
                            esq = chess.square(ef, er)
                            ep = board.piece_at(esq)
                            if ep and ep.piece_type == chess.PAWN and ep.color == color:
                                can_advance = True
                                break
                    if can_advance:
                        defended_by_pawn = True
                        break
            if not defended_by_pawn:
                enemy_attacks = list(board.attackers(not color, sq))
                if enemy_attacks:
                    weak.append(sq)
        if len(weak) >= 3:
            key_weak = weak[:5]
            results.append({
                "type": "weak_square",
                "side": side_name(color),
                "description": f"{side_name(color)} has weak squares that cannot be defended by pawns: {', '.join(sq_name(s) for s in key_weak)}.",
                "squares": [sq_name(s) for s in key_weak],
            })
    return results


def detect_bad_bishop(board):
    results = []
    for color in [chess.WHITE, chess.BLACK]:
        bishops = [(sq, board.piece_at(sq)) for sq in chess.SQUARES if board.piece_at(sq) and board.piece_at(sq).piece_type == chess.BISHOP and board.piece_at(sq).color == color]
        for bsq, bp in bishops:
            bishop_is_light = is_square_light(bsq)
            same_color_pawns = 0
            total_pawns = 0
            for sq in chess.SQUARES:
                p = board.piece_at(sq)
                if p and p.piece_type == chess.PAWN and p.color == color:
                    total_pawns += 1
                    if is_square_light(sq) == bishop_is_light:
                        same_color_pawns += 1
            if total_pawns >= 4 and same_color_pawns >= (total_pawns * 2 // 3):
                sq_color = "light" if bishop_is_light else "dark"
                results.append({
                    "type": "bad_bishop",
                    "side": side_name(color),
                    "description": f"{side_name(color)}'s Bishop on {sq_name(bsq)} is a bad bishop — {same_color_pawns} of {total_pawns} own pawns are on {sq_color} squares.",
                    "squares": [sq_name(bsq)],
                })
    return results


def detect_backward_pawns(board):
    results = []
    for color in [chess.WHITE, chess.BLACK]:
        for sq in chess.SQUARES:
            piece = board.piece_at(sq)
            if not piece or piece.piece_type != chess.PAWN or piece.color != color:
                continue
            f = chess.square_file(sq)
            r = chess.square_rank(sq)
            advance_sq = chess.square(f, r + 1) if color == chess.WHITE else chess.square(f, r - 1) if (color == chess.BLACK and r > 0) else None
            if advance_sq is None:
                continue
            advance_controlled = bool(list(board.attackers(not color, advance_sq)))
            if not advance_controlled:
                continue
            has_support = False
            for af in [f - 1, f + 1]:
                if 0 <= af <= 7:
                    if color == chess.WHITE:
                        for ar in range(1, r + 1):
                            asq = chess.square(af, ar)
                            ap = board.piece_at(asq)
                            if ap and ap.piece_type == chess.PAWN and ap.color == color:
                                has_support = True
                                break
                    else:
                        for ar in range(r, 7):
                            asq = chess.square(af, ar)
                            ap = board.piece_at(asq)
                            if ap and ap.piece_type == chess.PAWN and ap.color == color:
                                has_support = True
                                break
                if has_support:
                    break
            if not has_support:
                results.append({
                    "type": "backward_pawn",
                    "side": side_name(color),
                    "description": f"{side_name(color)}'s pawn on {sq_name(sq)} is backward — the square ahead is controlled and no friendly pawn can support its advance.",
                    "squares": [sq_name(sq)],
                })
    return results


def detect_space_advantage(board):
    white_space = 0
    black_space = 0
    for sq in chess.SQUARES:
        r = chess.square_rank(sq)
        if r >= 4:
            if list(board.attackers(chess.WHITE, sq)):
                white_space += 1
        if r <= 3:
            if list(board.attackers(chess.BLACK, sq)):
                black_space += 1
    diff = white_space - black_space
    if abs(diff) >= 5:
        leader = "White" if diff > 0 else "Black"
        desc = f"{leader} has a space advantage ({white_space} vs {black_space} controlled squares in the opponent's half)."
    else:
        desc = f"Space is roughly balanced ({white_space} White vs {black_space} Black controlled squares)."
    return {
        "type": "space_advantage",
        "white_space": white_space,
        "black_space": black_space,
        "description": desc,
    }


def detect_piece_coordination(board):
    results = []
    for color in [chess.WHITE, chess.BLACK]:
        unprotected = []
        for sq in chess.SQUARES:
            piece = board.piece_at(sq)
            if not piece or piece.color != color or piece.piece_type == chess.KING:
                continue
            if piece.piece_type == chess.PAWN:
                continue
            defenders = list(board.attackers(color, sq))
            if not defenders:
                attackers = list(board.attackers(not color, sq))
                if attackers:
                    unprotected.append((sq, piece))
        if len(unprotected) >= 2:
            names = [f"{piece_label(p.piece_type)} on {sq_name(s)}" for s, p in unprotected[:4]]
            results.append({
                "type": "piece_coordination",
                "side": side_name(color),
                "description": f"{side_name(color)} has poor piece coordination — {', '.join(names)} are unprotected and attacked.",
                "squares": [sq_name(s) for s, _ in unprotected[:4]],
            })
    return results


def detect_material(board):
    w_score = 0.0
    b_score = 0.0
    w_bishops = 0
    b_bishops = 0
    for sq in chess.SQUARES:
        p = board.piece_at(sq)
        if not p:
            continue
        v = KAUFMAN_VALUES.get(p.piece_type, 0)
        if p.color == chess.WHITE:
            w_score += v
            if p.piece_type == chess.BISHOP:
                w_bishops += 1
        else:
            b_score += v
            if p.piece_type == chess.BISHOP:
                b_bishops += 1
    w_bp = w_bishops >= 2
    b_bp = b_bishops >= 2
    if w_bp:
        w_score += 0.5
    if b_bp:
        b_score += 0.5
    balance = w_score - b_score
    diff = abs(balance)
    if diff < 0.3:
        desc = "Material is equal."
    elif balance > 0:
        desc = f"White is up {diff:.1f} in material value."
    else:
        desc = f"Black is up {diff:.1f} in material value."
    if w_bp and not b_bp:
        desc += " White has the bishop pair."
    elif b_bp and not w_bp:
        desc += " Black has the bishop pair."
    return {
        "type": "material",
        "white_score": w_score,
        "black_score": b_score,
        "balance": balance,
        "white_bishop_pair": w_bp,
        "black_bishop_pair": b_bp,
        "description": desc,
    }


def detect_king_safety(board):
    results = {}
    for color in [chess.WHITE, chess.BLACK]:
        king_sq = board.king(color)
        if king_sq is None:
            results[side_name(color).lower()] = {"description": "King not found."}
            continue
        kf = chess.square_file(king_sq)
        is_kingside = kf >= 5
        is_queenside = kf <= 2
        pawn_rank = 1 if color == chess.WHITE else 6
        adv_rank = 2 if color == chess.WHITE else 5
        shield_files = [5, 6, 7] if is_kingside else [0, 1, 2] if is_queenside else list(range(max(0, kf - 1), min(8, kf + 2)))
        missing = []
        if is_kingside or is_queenside:
            for f in shield_files:
                orig = chess.square(f, pawn_rank)
                adv = chess.square(f, adv_rank)
                has_orig = board.piece_at(orig) and board.piece_at(orig).piece_type == chess.PAWN and board.piece_at(orig).color == color
                has_adv = board.piece_at(adv) and board.piece_at(adv).piece_type == chess.PAWN and board.piece_at(adv).color == color
                if not has_orig and not has_adv:
                    missing.append(FILES[f])
        open_files = 0
        for f in shield_files:
            has_w = False
            has_b = False
            for r in range(8):
                p = board.piece_at(chess.square(f, r))
                if p and p.piece_type == chess.PAWN:
                    if p.color == chess.WHITE:
                        has_w = True
                    else:
                        has_b = True
            if not has_w and not has_b:
                open_files += 1
        sn = side_name(color)
        if not is_kingside and not is_queenside:
            desc = f"{sn}'s king is in the center ({sq_name(king_sq)})."
        elif missing:
            desc = f"{sn}'s pawn shield is weakened — missing pawns on {', '.join(missing)}-file(s)."
        else:
            desc = f"{sn}'s king is well-sheltered on {sq_name(king_sq)}."
        if open_files > 0:
            desc += f" {open_files} open file(s) near the king."
        results[side_name(color).lower()] = {
            "king_square": sq_name(king_sq),
            "pawn_shield_intact": len(missing) == 0,
            "shield_pawns_missing": missing,
            "open_files_near_king": open_files,
            "description": desc,
        }
    return results


def detect_pawn_structure(board):
    result = {}
    for color in [chess.WHITE, chess.BLACK]:
        pawns_by_file = {}
        enemy_by_file = {}
        for sq in chess.SQUARES:
            p = board.piece_at(sq)
            if not p or p.piece_type != chess.PAWN:
                continue
            f = chess.square_file(sq)
            r = chess.square_rank(sq)
            if p.color == color:
                pawns_by_file.setdefault(f, []).append(r)
            else:
                enemy_by_file.setdefault(f, []).append(r)
        doubled = 0
        isolated = 0
        passed = 0
        passed_squares = []
        for f, ranks in pawns_by_file.items():
            if len(ranks) > 1:
                doubled += len(ranks) - 1
            has_adj = (f > 0 and (f - 1) in pawns_by_file) or (f < 7 and (f + 1) in pawns_by_file)
            if not has_adj:
                isolated += len(ranks)
            for r in ranks:
                is_passed = True
                for cf in range(max(0, f - 1), min(8, f + 2)):
                    for er in enemy_by_file.get(cf, []):
                        if color == chess.WHITE and er > r:
                            is_passed = False
                        elif color == chess.BLACK and er < r:
                            is_passed = False
                if is_passed:
                    passed += 1
                    passed_squares.append(sq_name(chess.square(f, r)))
        result[side_name(color).lower()] = {
            "doubled": doubled,
            "isolated": isolated,
            "passed": passed,
            "passed_squares": passed_squares,
        }
    descs = []
    for sn in ["white", "black"]:
        d = result[sn]
        s = sn.capitalize()
        if d["doubled"] > 0:
            descs.append(f"{s} has {d['doubled']} doubled pawn(s).")
        if d["isolated"] > 0:
            descs.append(f"{s} has {d['isolated']} isolated pawn(s).")
        if d["passed"] > 0:
            descs.append(f"{s} has passed pawn(s) on {', '.join(d['passed_squares'])}.")
    result["description"] = " ".join(descs) if descs else "Pawn structure is symmetrical."
    return result


def is_endgame(board):
    w_mat = sum(KAUFMAN_VALUES.get(board.piece_at(sq).piece_type, 0) for sq in chess.SQUARES if board.piece_at(sq) and board.piece_at(sq).color == chess.WHITE and board.piece_at(sq).piece_type != chess.PAWN and board.piece_at(sq).piece_type != chess.KING)
    b_mat = sum(KAUFMAN_VALUES.get(board.piece_at(sq).piece_type, 0) for sq in chess.SQUARES if board.piece_at(sq) and board.piece_at(sq).color == chess.BLACK and board.piece_at(sq).piece_type != chess.PAWN and board.piece_at(sq).piece_type != chess.KING)
    return w_mat <= 13 and b_mat <= 13


def detect_active_king(board):
    results = []
    for color in [chess.WHITE, chess.BLACK]:
        king_sq = board.king(color)
        if king_sq is None:
            continue
        center_dist = min(
            abs(chess.square_file(king_sq) - chess.square_file(c)) + abs(chess.square_rank(king_sq) - chess.square_rank(c))
            for c in CENTER_SQUARES
        )
        if center_dist <= 2:
            results.append({
                "type": "active_king",
                "side": side_name(color),
                "description": f"{side_name(color)}'s king on {sq_name(king_sq)} is centralized and active (distance {center_dist} from center).",
                "squares": [sq_name(king_sq)],
            })
    return results


def detect_opposition(board):
    wk = board.king(chess.WHITE)
    bk = board.king(chess.BLACK)
    if wk is None or bk is None:
        return []
    wf, wr = chess.square_file(wk), chess.square_rank(wk)
    bf, br = chess.square_file(bk), chess.square_rank(bk)
    df = abs(wf - bf)
    dr = abs(wr - br)
    if (df == 0 and dr == 2) or (dr == 0 and df == 2):
        has_opp = side_name(not board.turn)
        return [{
            "type": "opposition",
            "side": has_opp,
            "description": f"{has_opp} has the opposition (kings face each other with one square between, opponent to move).",
            "squares": [sq_name(wk), sq_name(bk)],
        }]
    return []


def detect_outside_passer(board):
    results = []
    all_pawn_files = set()
    for sq in chess.SQUARES:
        p = board.piece_at(sq)
        if p and p.piece_type == chess.PAWN:
            all_pawn_files.add(chess.square_file(sq))
    for color in [chess.WHITE, chess.BLACK]:
        for sq in get_passed_pawns(board, color):
            f = chess.square_file(sq)
            other_files = [of for of in all_pawn_files if of != f]
            if other_files:
                min_dist = min(abs(f - of) for of in other_files)
                if min_dist >= 3:
                    results.append({
                        "type": "outside_passer",
                        "side": side_name(color),
                        "description": f"{side_name(color)}'s passed pawn on {sq_name(sq)} is an outside passer ({min_dist} files from nearest pawn) — a powerful decoy.",
                        "squares": [sq_name(sq)],
                    })
    return results


def detect_rook_behind_passer(board):
    results = []
    for color in [chess.WHITE, chess.BLACK]:
        passed = get_passed_pawns(board, color)
        for psq in passed:
            pf = chess.square_file(psq)
            pr = chess.square_rank(psq)
            for sq in chess.SQUARES:
                p = board.piece_at(sq)
                if not p or p.piece_type != chess.ROOK or p.color != color:
                    continue
                if chess.square_file(sq) == pf:
                    rr = chess.square_rank(sq)
                    if (color == chess.WHITE and rr < pr) or (color == chess.BLACK and rr > pr):
                        results.append({
                            "type": "rook_behind_passer",
                            "side": side_name(color),
                            "description": f"{side_name(color)}'s Rook on {sq_name(sq)} is behind the passed pawn on {sq_name(psq)} (Tarrasch's rule).",
                            "squares": [sq_name(sq), sq_name(psq)],
                        })
    return results


def detect_pawn_majority(board):
    results = []
    w_qs = sum(1 for sq in chess.SQUARES if board.piece_at(sq) and board.piece_at(sq).piece_type == chess.PAWN and board.piece_at(sq).color == chess.WHITE and chess.square_file(sq) <= 3)
    w_ks = sum(1 for sq in chess.SQUARES if board.piece_at(sq) and board.piece_at(sq).piece_type == chess.PAWN and board.piece_at(sq).color == chess.WHITE and chess.square_file(sq) >= 4)
    b_qs = sum(1 for sq in chess.SQUARES if board.piece_at(sq) and board.piece_at(sq).piece_type == chess.PAWN and board.piece_at(sq).color == chess.BLACK and chess.square_file(sq) <= 3)
    b_ks = sum(1 for sq in chess.SQUARES if board.piece_at(sq) and board.piece_at(sq).piece_type == chess.PAWN and board.piece_at(sq).color == chess.BLACK and chess.square_file(sq) >= 4)
    descs = []
    if w_qs > b_qs:
        descs.append(f"White has a queenside pawn majority ({w_qs} vs {b_qs}).")
    elif b_qs > w_qs:
        descs.append(f"Black has a queenside pawn majority ({b_qs} vs {w_qs}).")
    if w_ks > b_ks:
        descs.append(f"White has a kingside pawn majority ({w_ks} vs {b_ks}).")
    elif b_ks > w_ks:
        descs.append(f"Black has a kingside pawn majority ({b_ks} vs {w_ks}).")
    if descs:
        return [{
            "type": "pawn_majority",
            "side": "Both",
            "description": " ".join(descs),
            "white_queenside": w_qs, "white_kingside": w_ks,
            "black_queenside": b_qs, "black_kingside": b_ks,
        }]
    return []


def detect_king_cutoff(board):
    results = []
    for color in [chess.WHITE, chess.BLACK]:
        enemy_king = board.king(not color)
        if enemy_king is None:
            continue
        ek_file = chess.square_file(enemy_king)
        ek_rank = chess.square_rank(enemy_king)
        for sq in chess.SQUARES:
            p = board.piece_at(sq)
            if not p or p.color != color or p.piece_type not in (chess.ROOK, chess.QUEEN):
                continue
            rf = chess.square_file(sq)
            rr = chess.square_rank(sq)
            if rf == ek_file or rr == ek_rank:
                continue
            if abs(rf - ek_file) == 1:
                blocked = True
                for r in range(8):
                    bsq = chess.square(rf, r)
                    bp = board.piece_at(bsq)
                    if bp and bsq != sq:
                        blocked = False
                        break
                if blocked:
                    continue
                results.append({
                    "type": "king_cutoff",
                    "side": side_name(color),
                    "description": f"{side_name(color)}'s {piece_label(p.piece_type)} on {sq_name(sq)} cuts off {side_name(not color)}'s king from the {('kingside' if rf > ek_file else 'queenside')}.",
                    "squares": [sq_name(sq), sq_name(enemy_king)],
                })
                break
            if abs(rr - ek_rank) == 1:
                results.append({
                    "type": "king_cutoff",
                    "side": side_name(color),
                    "description": f"{side_name(color)}'s {piece_label(p.piece_type)} on {sq_name(sq)} cuts off {side_name(not color)}'s king along the {('rank' if rr != ek_rank else 'file')}.",
                    "squares": [sq_name(sq), sq_name(enemy_king)],
                })
                break
    return results


def analyze_position(fen, last_move_uci=None):
    try:
        board = chess.Board(fen)
    except Exception as e:
        return {"error": str(e)}

    if last_move_uci:
        try:
            move = chess.Move.from_uci(last_move_uci)
            board.move_stack.append(move)
        except Exception:
            pass

    tactical = []
    tactical.extend(detect_hanging_pieces(board))
    tactical.extend(detect_forks(board))
    tactical.extend(detect_pins(board))
    tactical.extend(detect_pin_relative(board))
    tactical.extend(detect_direct_material_loss(board))
    tactical.extend(detect_skewers(board))
    tactical.extend(detect_overloaded_defenders(board))
    tactical.extend(detect_trapped_pieces(board))
    tactical.extend(detect_mating_threats(board))
    tactical.extend(detect_promotion_race(board))
    tactical.extend(detect_tactical_refutation(board))
    try:
        tactical.extend(detect_discovered_attacks(board))
    except:
        pass

    material = detect_material(board)
    king_safety = detect_king_safety(board)
    pawn_structure = detect_pawn_structure(board)
    center = detect_center_control(board)
    space = detect_space_advantage(board)

    strategic = []
    strategic.extend(detect_development_lead(board))
    strategic.extend(detect_rook_placement(board))
    strategic.extend(detect_piece_activity(board))
    strategic.extend(detect_outposts(board))
    strategic.extend(detect_weak_squares(board))
    strategic.extend(detect_bad_bishop(board))
    strategic.extend(detect_backward_pawns(board))
    strategic.extend(detect_piece_coordination(board))

    endgame = []
    endgame_active = is_endgame(board)
    if endgame_active:
        endgame.extend(detect_active_king(board))
        endgame.extend(detect_opposition(board))
        endgame.extend(detect_outside_passer(board))
        endgame.extend(detect_rook_behind_passer(board))
        endgame.extend(detect_pawn_majority(board))
        endgame.extend(detect_king_cutoff(board))

    summary_parts = []
    if material["description"] != "Material is equal.":
        summary_parts.append(material["description"])
    if len(tactical) > 0:
        tac_types = set(t["type"] for t in tactical)
        summary_parts.append(f"Tactical themes: {', '.join(t.replace('_', ' ') for t in tac_types)}.")
    if center["description"] != f"Center control is balanced ({center['white_control']} vs {center['black_control']}).":
        summary_parts.append(center["description"])
    if any(s["type"] in ("outpost", "bad_bishop", "backward_pawn") for s in strategic):
        strat_types = set(s["type"] for s in strategic if s["type"] in ("outpost", "bad_bishop", "backward_pawn"))
        summary_parts.append(f"Strategic themes: {', '.join(t.replace('_', ' ') for t in strat_types)}.")
    if pawn_structure["description"] != "Pawn structure is symmetrical.":
        summary_parts.append(pawn_structure["description"])
    if endgame_active and endgame:
        eg_types = set(e["type"] for e in endgame)
        summary_parts.append(f"Endgame factors: {', '.join(t.replace('_', ' ') for t in eg_types)}.")

    return {
        "material": material,
        "king_safety": king_safety,
        "pawn_structure": pawn_structure,
        "center_control": center,
        "space": space,
        "tactical": tactical,
        "strategic": strategic,
        "endgame": endgame,
        "is_endgame": endgame_active,
        "summary": " ".join(summary_parts) if summary_parts else "Position is balanced with no notable imbalances.",
    }


def main():
    signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))
    sys.stdout.write('{"status":"ready"}\n')
    sys.stdout.flush()

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
        except json.JSONDecodeError:
            continue
        req_id = req.get("id", "")
        fen = req.get("fen", "")
        last_move = req.get("lastMove", None)
        try:
            result = analyze_position(fen, last_move)
            resp = {"id": req_id, "result": result}
        except Exception as e:
            resp = {"id": req_id, "error": str(e)}
        sys.stdout.write(json.dumps(resp) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()

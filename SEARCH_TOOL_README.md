# Line History Search Tool

A command-line tool to search and query betting line history for specific teams, games, and sports categories.

## Features

- 🔍 Search by team name (case-insensitive partial matching)
- 🏀 Filter by sport category (NBA, NFL, NCAA Basketball, NCAA Football)
- 🎮 Search for specific games (home vs away)
- 📊 View original lines, current lines, and line movements
- 📈 Track all movements for teams
- 📋 Multiple output formats (table, JSON, detailed)

## Usage

### Search by Team

```bash
# Search for any team
python3 search_lines.py --team "Lakers"

# Search with sport filter
python3 search_lines.py --team "Lakers" --sport "NBA"

# Show only movements
python3 search_lines.py --team "Lakers" --movements-only

# Show only current lines
python3 search_lines.py --team "Lakers" --current-only
```

### Search for Specific Game

```bash
# Search for a specific game
python3 search_lines.py --game "Lakers" "Warriors"

# Or with home/away specified
python3 search_lines.py --game "Golden State Warriors" "Los Angeles Lakers"
```

### Search by Sport

```bash
# Get all games in a sport category
python3 search_lines.py --sport "NBA"
python3 search_lines.py --sport "NFL"
python3 search_lines.py --sport "NCAA Basketball"
python3 search_lines.py --sport "NCAA Football"
```

### Output Formats

```bash
# Table format (default, human-readable)
python3 search_lines.py --team "Lakers"

# JSON format (for scripting/automation)
python3 search_lines.py --team "Lakers" --format json

# Detailed format
python3 search_lines.py --team "Lakers" --format detailed
```

## Command Line Options

- `--team, -t`: Team name to search for (partial matching, case-insensitive)
- `--sport, -s`: Sport category filter (NBA, NFL, NCAA Basketball, NCAA Football)
- `--game, -g`: Search for specific game (requires home and away team names)
- `--format, -f`: Output format (table, json, detailed) - default: table
- `--movements-only`: Show only line movements
- `--current-only`: Show only current lines

## Examples

### Find all Lakers games and movements

```bash
python3 search_lines.py --team "Lakers"
```

### Find current lines for a specific game

```bash
python3 search_lines.py --game "Lakers" "Warriors" --current-only
```

### Get all movements for a team in JSON format

```bash
python3 search_lines.py --team "Lakers" --movements-only --format json
```

### Find all NFL games

```bash
python3 search_lines.py --sport "NFL"
```

## Output Information

The search tool provides:

1. **Original Lines**: Initial spreads and totals when games were first discovered
2. **Current Lines**: Latest spreads and totals from all bookmakers
3. **Line Movements**: All movements ≥2 points with timestamps and direction
4. **Movement Direction**: Which team the spread is moving towards

## Data Sources

The tool searches through:
- `original_lines.json` - Initial lines when games were first discovered
- `line_movements.json` - All significant line movements (≥2 points)
- `draftkings_history.json` - Current lines and historical tracking

## Tips

- Team names are matched partially and case-insensitively
- Use partial team names for broader results (e.g., "Lakers" matches "Los Angeles Lakers")
- Combine `--team` and `--sport` for more specific results
- Use `--format json` for programmatic access to the data
- Use `--movements-only` to focus on line changes only


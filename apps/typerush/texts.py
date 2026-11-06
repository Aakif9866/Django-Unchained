"""The internal collection of typing passages."""
PROSE = [
    "The best way to get good at something is to do it badly for a while and keep showing up anyway.",
    "A lighthouse does not chase ships around the harbour. It stands still and keeps the light on.",
    "Rain tapped against the window while the kettle worked itself up to a whistle in the next room.",
    "Most maps leave out the interesting parts, which is why people keep wandering off the marked trail.",
    "She packed one bag, left the spare key under the third plant, and caught the first train north.",
    "Good tools disappear in your hand. You stop thinking about the hammer and start thinking about the house.",
    "Every old town has one bakery everyone argues about and one street nobody can explain.",
    "The trick to a long walk is to forget how far you have left and notice what is right in front of you.",
    "He kept a list of questions in his coat pocket and crossed one off whenever a stranger answered it.",
    "Clouds rolled over the ridge just after noon, and the whole valley turned the colour of old pewter.",
    "Small habits rarely look impressive on a given day, yet over ten years they quietly build a life.",
    "Nobody remembers the meeting that could have been an email, but everybody remembers a good story.",
    "The market opens at dawn, when the fishmongers shout over each other and the coffee is still too hot.",
    "If you want to understand a machine, take it apart once, and then try to put it back together.",
    "There is a particular quiet that falls over a library just before the rain begins to fall outside.",
    "The old radio only found two stations, but one of them played jazz until the sun came up.",
]

CODE = [
    "def fizzbuzz(n):\n    for i in range(1, n + 1):\n        print('Fizz' * (i % 3 == 0) + 'Buzz' * (i % 5 == 0) or i)",
    "const unique = (items) => [...new Set(items)];\nconst total = prices.reduce((sum, p) => sum + p, 0);",
    "SELECT user_id, COUNT(*) AS plays\nFROM scores\nWHERE created_at > '2026-01-01'\nGROUP BY user_id\nORDER BY plays DESC;",
    "class Stack:\n    def __init__(self):\n        self.items = []\n\n    def push(self, item):\n        self.items.append(item)",
    "async function getJson(url) {\n  const response = await fetch(url);\n  if (!response.ok) throw new Error(response.status);\n  return response.json();\n}",
    "git checkout -b feature/search\ngit add -p\ngit commit -m 'Add search'\ngit push -u origin feature/search",
    "squares = {n: n ** 2 for n in range(10) if n % 2 == 0}\nnames = sorted(users, key=lambda u: u.last_seen)",
    "for (let i = 0; i < grid.length; i++) {\n  if (grid[i] === target) return i;\n}\nreturn -1;",
    "@login_required\ndef profile(request):\n    form = ProfileForm(request.POST or None)\n    return render(request, 'profile.html', {'form': form})",
    "docker build -t sidequest:latest .\ndocker run --rm -p 8000:8000 sidequest:latest",
    "while left <= right:\n    mid = (left + right) // 2\n    if items[mid] < target:\n        left = mid + 1\n    else:\n        right = mid - 1",
    "curl -X POST https://api.example.com/v1/items \\\n  -H 'Content-Type: application/json' \\\n  -d '{\"name\": \"quest\"}'",
    "export const debounce = (fn, ms) => {\n  let timer;\n  return (...args) => {\n    clearTimeout(timer);\n    timer = setTimeout(() => fn(...args), ms);\n  };\n};",
    "with open('data.csv', newline='') as handle:\n    for row in csv.DictReader(handle):\n        totals[row['city']] += int(row['sales'])",
]

COLLECTIONS = {"prose": PROSE, "code": CODE}

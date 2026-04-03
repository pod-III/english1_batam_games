#!/bin/bash

# KlassKit Activity Generator
# Usage: ./tools/new-activity.sh <id> <title> <category:tool|game>

if [ "$#" -ne 3 ]; then
    echo "Usage: $0 <id> <title> <category:tool|game>"
    exit 1
fi

ID=$1
TITLE=$2
CAT=$3

if [ "$CAT" == "tool" ]; then
    DIR="tools/$ID"
else
    DIR="games/$ID"
fi

if [ -d "$DIR" ]; then
    echo "Error: Directory $DIR already exists!"
    exit 1
fi

mkdir -p "$DIR"

# Create index.html template
cat <<EOF > "$DIR/index.html"
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>$TITLE - KlassKit</title>
    
    <!-- External Libraries -->
    <script src="https://unpkg.com/lucide@latest"></script>
    <script src="https://cdn.tailwindcss.com"></script>
    
    <!-- Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600;700&family=Nunito:wght@400;600;800&display=swap" rel="stylesheet">

    <!-- Theme Configuration -->
    <script>
        tailwind.config = {
            darkMode: 'class',
            theme: {
                extend: {
                    colors: {
                        pink: '#ff4785',
                        orange: '#ff7e33',
                        green: '#00d063',
                        blue: '#1ea7fd',
                        dark: '#1e293b',
                    },
                    fontFamily: {
                        heading: ['Fredoka', 'sans-serif'],
                        body: ['Nunito', 'sans-serif'],
                    }
                }
            }
        }
    </script>

    <!-- Global Styles -->
    <link rel="stylesheet" href="../../css/base.css">
    <link rel="stylesheet" href="../../css/components.css">
    
    <style>
        body {
            font-family: 'Nunito', sans-serif;
            background-color: var(--bg-primary);
            color: var(--text-primary);
        }
    </style>
</head>
<body class="min-h-screen flex flex-col p-8">
    <header class="flex items-center justify-between mb-8">
        <div class="flex items-center gap-4">
            <div class="w-12 h-12 bg-blue rounded-xl flex items-center justify-center text-white border-3 border-dark shadow-hard">
                <i data-lucide="star" class="w-6 h-6"></i>
            </div>
            <h1 class="text-3xl font-heading font-bold">$TITLE</h1>
        </div>
        <button class="btn-chunky bg-white px-6 py-2 rounded-xl" onclick="history.back()">Back</button>
    </header>

    <main class="flex-1 grid place-items-center">
        <div class="glass-panel p-12 rounded-3xl border-3 border-dark text-center">
            <h2 class="text-2xl font-bold mb-4">Welcome to $TITLE</h2>
            <p class="text-slate-500 mb-8">Start building your activity here!</p>
            <button class="btn-chunky bg-green text-white px-8 py-3 rounded-xl" onclick="alert('Action!')">Example Button</button>
        </div>
    </main>

    <script>
        // Use LocalStorage for persistence
        function init() {
            lucide.createIcons();
            const countStr = localStorage.getItem('visitCount') || '0';
            const count = parseInt(countStr);
            localStorage.setItem('visitCount', (count + 1).toString());
            console.log(`Visit count: ${count + 1}`);
        }
        init();
    </script>
</body>
</html>
EOF

echo "Activity $TITLE created at $DIR"
echo "Don't forget to add it to games.json!"
echo "ID: $ID"
echo "Path: ./$DIR/index.html"

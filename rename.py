import os

replacements = [
    ("Om Sri Manakula Vinayagar!", "Arulmigu Manakula Vinayagar Devasthanam"),
    ("Sri Manakula", "Arulmigu Manakula"),
    ("Sri ManakulaVINAYAGAR", "Arulmigu Manakula Vinayagar"),
    ("Sri Manakula VINAYAGAR", "Arulmigu Manakula Vinayagar")
]

directories = ["frontend/src", "backend/app", "."] # include root for mvp.html if needed, but let's just do frontend/src, backend/app, and mvp.html explicitly

targets = ["frontend/src", "backend/app", "mvp.html"]

for t in targets:
    if os.path.isfile(t):
        path = t
        with open(path, 'r') as file:
            content = file.read()
        new_content = content
        for old, new in replacements:
            new_content = new_content.replace(old, new)
        if new_content != content:
            with open(path, 'w') as file:
                file.write(new_content)
            print(f"Updated {path}")
    else:
        for root, _, files in os.walk(t):
            for f in files:
                if f.endswith((".jsx", ".js", ".py", ".html", ".md", ".css")):
                    path = os.path.join(root, f)
                    with open(path, 'r') as file:
                        content = file.read()
                    
                    new_content = content
                    for old, new in replacements:
                        new_content = new_content.replace(old, new)
                    
                    if new_content != content:
                        with open(path, 'w') as file:
                            file.write(new_content)
                        print(f"Updated {path}")

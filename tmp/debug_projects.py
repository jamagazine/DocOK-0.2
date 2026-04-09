import os
import json
import datetime

PROJECTS_DIR = r"c:\Project\DocOK\DocOK_0.2.5\data\projects"

def list_projects():
    projects_list = []
    if not os.path.exists(PROJECTS_DIR):
        print("DIR NOT FOUND")
        return []
        
    for pid in os.listdir(PROJECTS_DIR):
        p_path = os.path.join(PROJECTS_DIR, pid)
        if not os.path.isdir(p_path): continue
            
        state_file = os.path.join(p_path, "project_state.json")
        if not os.path.exists(state_file): 
            print(f"STATE NOT FOUND in {pid}")
            continue
            
        try:
            with open(state_file, "r", encoding="utf-8") as f:
                state = json.load(f)
            
            # 0. Versioning: Update to 1.1
            state["version"] = "1.1"
            
            # 1. Dynamic Files Count Sync (Using direct local path)
            f_dir = os.path.join(p_path, "files")
            if os.path.exists(f_dir):
                state["filesCount"] = len([f for f in os.listdir(f_dir) if os.path.isfile(os.path.join(f_dir, f)) and not f.lower().endswith(('.json', '.md'))])
            else:
                state["filesCount"] = 0
            
            # 2. Dynamic Last Modified Time
            mtimes = [os.path.getmtime(state_file)]
            for meta_file in ["manifest.json", "history.json"]:
                mp = os.path.join(p_path, meta_file)
                if os.path.exists(mp): mtimes.append(os.path.getmtime(mp))
            
            if os.path.exists(f_dir):
                for f in os.listdir(f_dir):
                    mtimes.append(os.path.getmtime(os.path.join(f_dir, f)))
            
            max_mtime = max(mtimes)
            dt = datetime.datetime.fromtimestamp(max_mtime)
            state["lastModified"] = dt.strftime("%H:%M | %d.%m.%y")
            
            projects_list.append(state)
        except Exception as e:
            print(f"Error syncing project {pid}: {e}")
                
    return projects_list

res = list_projects()
print(f"FOUND {len(res)} PROJECTS")
if len(res) > 0:
    print(res[0].keys())

import os,sys,zipfile
root,target=sys.argv[1:]
with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED) as archive:
    for directory,dirs,files in os.walk(root):
        dirs.sort()
        for name in sorted(files):
            path=os.path.join(directory,name)
            info=zipfile.ZipInfo(os.path.relpath(path,root),(2026,1,1,0,0,0))
            info.compress_type=zipfile.ZIP_DEFLATED
            info.external_attr=0o644<<16
            with open(path,'rb') as source: archive.writestr(info,source.read())

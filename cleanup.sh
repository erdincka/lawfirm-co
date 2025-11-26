#!/bin/bash
# Automated Cleanup Script for Lawfirm-co Project
# This script performs safe cleanup operations based on the cleanup report

set -e  # Exit on error

echo "🧹 Starting automated cleanup for lawfirm-co project..."
echo "=================================================="

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Change to project root
cd "$(dirname "$0")"

echo ""
echo "Step 1: Backing up files before cleanup..."
echo "-------------------------------------------"

# Create backup directory with timestamp
BACKUP_DIR="backups/cleanup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Backup RAG documentation files
if [ -d "backend" ]; then
    mkdir -p "$BACKUP_DIR/rag_docs"
    for file in backend/RAG_*.md; do
        if [ -f "$file" ]; then
            cp "$file" "$BACKUP_DIR/rag_docs/"
            print_status "Backed up: $file"
        fi
    done
fi

# Backup test file
if [ -f "backend/test_rag.py" ]; then
    cp backend/test_rag.py "$BACKUP_DIR/"
    print_status "Backed up: backend/test_rag.py"
fi

print_status "Backup completed in: $BACKUP_DIR"

echo ""
echo "Step 2: Removing redundant RAG documentation..."
echo "------------------------------------------------"

# Remove RAG documentation files (keep RAG_README.md as reference)
RAG_DOCS_TO_REMOVE=(
    "backend/RAG_EMBEDDING_FIX.md"
    "backend/RAG_ENHANCEMENT_SUMMARY.md"
    "backend/RAG_FLOW_DIAGRAM.md"
    "backend/RAG_IMPLEMENTATION.md"
    "backend/RAG_QUICK_REFERENCE.md"
    "backend/RAG_TESTING_GUIDE.md"
)

for file in "${RAG_DOCS_TO_REMOVE[@]}"; do
    if [ -f "$file" ]; then
        rm "$file"
        print_status "Removed: $file"
    else
        print_warning "Not found: $file"
    fi
done

# Keep RAG_README.md but move it to docs
if [ -f "backend/RAG_README.md" ]; then
    mkdir -p "docs"
    mv backend/RAG_README.md docs/RAG_README.md
    print_status "Moved: backend/RAG_README.md → docs/RAG_README.md"
fi

echo ""
echo "Step 3: Moving test files to proper location..."
echo "------------------------------------------------"

# Create tests directory if it doesn't exist
mkdir -p backend/tests

# Move test file
if [ -f "backend/test_rag.py" ]; then
    mv backend/test_rag.py backend/tests/
    print_status "Moved: backend/test_rag.py → backend/tests/"
fi

# Create __init__.py for tests package
touch backend/tests/__init__.py
print_status "Created: backend/tests/__init__.py"

echo ""
echo "Step 4: Checking for unused dependencies..."
echo "--------------------------------------------"

# Check if pandas is actually used in the code
if grep -r "import pandas" backend/app/ > /dev/null 2>&1; then
    print_warning "pandas is imported in code - keeping in requirements.txt"
else
    print_status "pandas not used in code - can be removed from requirements.txt"
    echo "  → Manual action: Remove 'pandas==2.2.0' from backend/requirements.txt"
fi

echo ""
echo "Step 5: Creating utility directories..."
echo "----------------------------------------"

# Create recommended directory structure
mkdir -p backend/app/core
mkdir -p backend/app/services
mkdir -p backend/app/utils
mkdir -p docs/development
mkdir -p docs/api

print_status "Created: backend/app/core/"
print_status "Created: backend/app/services/"
print_status "Created: backend/app/utils/"
print_status "Created: docs/development/"
print_status "Created: docs/api/"

echo ""
echo "Step 6: Generating .gitignore additions..."
echo "-------------------------------------------"

# Add backup directory to .gitignore if not already there
if ! grep -q "^backups/" .gitignore 2>/dev/null; then
    echo "" >> .gitignore
    echo "# Cleanup backups" >> .gitignore
    echo "backups/" >> .gitignore
    print_status "Added 'backups/' to .gitignore"
else
    print_status ".gitignore already contains backups/"
fi

echo ""
echo "Step 7: Creating cleanup summary..."
echo "------------------------------------"

# Create summary file
SUMMARY_FILE="$BACKUP_DIR/cleanup_summary.txt"
cat > "$SUMMARY_FILE" << EOF
Cleanup Summary
===============
Date: $(date)
Backup Location: $BACKUP_DIR

Files Removed:
--------------
$(for file in "${RAG_DOCS_TO_REMOVE[@]}"; do echo "  - $file"; done)

Files Moved:
------------
  - backend/RAG_README.md → docs/RAG_README.md
  - backend/test_rag.py → backend/tests/test_rag.py

Directories Created:
--------------------
  - backend/tests/
  - backend/app/core/
  - backend/app/services/
  - backend/app/utils/
  - docs/development/
  - docs/api/

Next Steps:
-----------
1. Review CLEANUP_REPORT.md for detailed recommendations
2. Update CORS configuration in backend/app/main.py
3. Replace print() statements with proper logging
4. Remove pandas from requirements.txt if not needed
5. Add rate limiting to API endpoints
6. Configure environment variables for production

Backup:
-------
All removed files are backed up in: $BACKUP_DIR
To restore, copy files back from this directory.
EOF

print_status "Created cleanup summary: $SUMMARY_FILE"

echo ""
echo "=================================================="
echo "✨ Cleanup completed successfully!"
echo "=================================================="
echo ""
echo "Summary:"
echo "  - Removed: ${#RAG_DOCS_TO_REMOVE[@]} RAG documentation files"
echo "  - Moved: 2 files to proper locations"
echo "  - Created: 5 new directories"
echo "  - Backup: $BACKUP_DIR"
echo ""
echo "Next steps:"
echo "  1. Review: CLEANUP_REPORT.md"
echo "  2. Review: $SUMMARY_FILE"
echo "  3. Test: Run 'tilt up' to ensure everything still works"
echo "  4. Commit: Git commit the changes"
echo ""
echo "⚠️  Manual actions required:"
echo "  - Update CORS in backend/app/main.py"
echo "  - Replace print() with logging"
echo "  - Review and remove pandas from requirements.txt if unused"
echo ""

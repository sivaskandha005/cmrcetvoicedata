// ============================================================
//  VoiceBank — Shared Tag Input Widget
//  Drop this into any page that needs tag input
// ============================================================

/**
 * TagInput — turns a container div into an interactive tag input.
 *
 * Usage:
 *   const ti = new TagInput('myContainerId', ['preset','tags']);
 *   ti.getTags()   → returns array of current tag strings
 *   ti.setTags([]) → replaces all tags
 *
 * Press Enter or comma to add a tag.
 * Click × on a tag to remove it.
 */
class TagInput {
  constructor(containerId, initialTags = []) {
    this.container = document.getElementById(containerId);
    this.tags = [];
    this._build();
    initialTags.forEach(t => this._addTag(t));
  }

  _build() {
    this.container.className = 'tag-input-wrap';
    this.container.innerHTML = '';

    this.inner = document.createElement('div');
    this.inner.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;align-items:center;flex:1';
    this.container.appendChild(this.inner);

    this.input = document.createElement('input');
    this.input.placeholder = 'Type a tag, press Enter…';
    this.inner.appendChild(this.input);

    this.input.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const val = this.input.value.trim().replace(/,/g, '');
        if (val) this._addTag(val);
        this.input.value = '';
      }
      if (e.key === 'Backspace' && !this.input.value && this.tags.length) {
        this._removeTag(this.tags[this.tags.length - 1]);
      }
    });

    // clicking anywhere in the box focuses the input
    this.container.addEventListener('click', () => this.input.focus());
  }

  _addTag(text) {
    const clean = text.trim().toLowerCase().replace(/\s+/g, '-');
    if (!clean || this.tags.includes(clean)) return;
    this.tags.push(clean);
    this._renderTag(clean);
  }

  _renderTag(text) {
    const chip = document.createElement('span');
    chip.className = 'tag removable';
    chip.dataset.tag = text;
    chip.innerHTML = `${escHtmlUtil(text)}<span class="tag-remove">×</span>`;
    chip.querySelector('.tag-remove').addEventListener('click', e => {
      e.stopPropagation();
      this._removeTag(text);
    });
    // insert before the input
    this.inner.insertBefore(chip, this.input);
  }

  _removeTag(text) {
    this.tags = this.tags.filter(t => t !== text);
    const chip = this.inner.querySelector(`[data-tag="${text}"]`);
    if (chip) chip.remove();
  }

  getTags() { return [...this.tags]; }

  setTags(arr) {
    // clear existing
    this.inner.querySelectorAll('.tag').forEach(c => c.remove());
    this.tags = [];
    arr.forEach(t => this._addTag(t));
  }
}

// small util so this file has no dependency on admin.js
function escHtmlUtil(t) {
  return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

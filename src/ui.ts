import { App, Modal, Notice } from 'obsidian';
import { t } from './i18n';
import { PluginInterface } from './types';
import { ForumPreset } from './config';

// 选择分类的模态框
export class SelectCategoryModal extends Modal {
    plugin: PluginInterface;
    categories: {id: number; name: string}[];
    tags: { name: string; canCreate: boolean }[];
    canCreateTags = false;

    constructor(app: App, plugin: PluginInterface, categories: {id: number; name: string }[], tags: { name: string; canCreate: boolean }[]) {
        super(app);
        this.plugin = plugin;
        this.categories = categories;
        this.tags = tags;
        this.canCreateTags = tags.length > 0 && tags[0].canCreate;
    }

    onOpen() {
        // 添加模态框基础样式
        this.modalEl.addClass('mod-discourse-sync');
        
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('discourse-sync-modal');
        
        const isUpdate = this.plugin.activeFile.postId !== undefined;
        contentEl.createEl('h1', { text: isUpdate ? t('UPDATE_POST') : t('PUBLISH_TO_DISCOURSE') });

        // 创建表单区域容器
        const formArea = contentEl.createEl('div', { cls: 'form-area' });

        // 创建分类选择容器
        const selectContainer = formArea.createEl('div', { cls: 'select-container' });
        selectContainer.createEl('label', { text: t('CATEGORY') });
        const selectEl = selectContainer.createEl('select');
        
        // 添加分类选项
        this.categories.forEach(category => {
            const option = selectEl.createEl('option', { text: category.name });
            option.value = category.id.toString();
        });
        
        // 设置默认选中的分类
        selectEl.value = this.plugin.settings.category?.toString() || this.categories[0].id.toString();
        
        // 监听分类选择变化
        selectEl.onchange = () => {
            this.plugin.settings.category = parseInt(selectEl.value);
            this.plugin.saveSettings();
        };

        // 创建标签容器
        const tagContainer = formArea.createEl('div', { cls: 'tag-container' });
        tagContainer.createEl('label', { text: t('TAGS') });
        
        // 创建标签选择区域
        const tagSelectArea = tagContainer.createEl('div', { cls: 'tag-select-area' });
        
        // 已选标签显示区域
        const selectedTagsContainer = tagSelectArea.createEl('div', { cls: 'selected-tags' });
        const selectedTags = new Set<string>();
        
        // 初始化已选标签
        if (this.plugin.activeFile.tags && this.plugin.activeFile.tags.length > 0) {
            this.plugin.activeFile.tags.forEach(tag => selectedTags.add(tag));
        }
        
        // 更新标签显示
        const updateSelectedTags = () => {
            selectedTagsContainer.empty();
            selectedTags.forEach(tag => {
                const tagEl = selectedTagsContainer.createEl('span', { 
                    cls: 'tag',
                    text: tag
                });
                const removeBtn = tagEl.createEl('span', {
                    cls: 'remove-tag',
                    text: '×'
                });
                removeBtn.onclick = () => {
                    selectedTags.delete(tag);
                    updateSelectedTags();
                    showDefaultTags(); // 重新显示网格，让移除的标签重新出现
                };
            });
        };
        
        // 初始化标签显示
        updateSelectedTags();
        
        // 创建标签输入容器
        const tagInputContainer = tagSelectArea.createEl('div', { cls: 'tag-input-container' });
        
        // 创建标签输入和建议
        const tagInput = tagInputContainer.createEl('input', {
            type: 'text',
            placeholder: this.canCreateTags ? t('ENTER_TAG_WITH_CREATE') : t('ENTER_TAG')
        });
        
        // 创建标签建议容器
        const tagSuggestions = tagInputContainer.createEl('div', { cls: 'tag-suggestions' });
        
        // 创建默认标签网格容器
        const defaultTagsGrid = tagInputContainer.createEl('div', { cls: 'default-tags-grid' });
        
        // 显示默认标签网格
        const showDefaultTags = () => {
            defaultTagsGrid.empty();
            const availableTags = this.tags.filter(tag => !selectedTags.has(tag.name)).slice(0, 20);
            
            if (availableTags.length > 0) {
                availableTags.forEach(tag => {
                    const tagEl = defaultTagsGrid.createEl('span', {
                        cls: 'grid-tag',
                        text: tag.name
                    });
                    tagEl.onclick = () => {
                        selectedTags.add(tag.name);
                        updateSelectedTags();
                        showDefaultTags(); // 重新显示网格，移除已选标签
                    };
                });
            }
        };
        
        // 初始化显示默认标签网格
        showDefaultTags();
        
        // 处理输入事件，显示匹配的标签
        tagInput.oninput = () => {
            const value = tagInput.value.toLowerCase();
            
            if (value) {
                // 有输入时隐藏默认网格，显示搜索结果
                defaultTagsGrid.style.display = 'none';
                tagSuggestions.empty();
                
                const matches = this.tags
                    .filter(tag => 
                        tag.name.toLowerCase().includes(value) && 
                        !selectedTags.has(tag.name)
                    )
                    .slice(0, 20); // 搜索结果显示更多
                
                if (matches.length > 0) {
                    // 获取输入框位置和宽度
                    const inputRect = tagInput.getBoundingClientRect();
                    const modalRect = this.modalEl.getBoundingClientRect();
                    
                    // 确保建议列表不超过模态框宽度
                    const maxWidth = modalRect.right - inputRect.left - 24; // 24px是右边距
                    
                    // 设置建议列表位置和宽度
                    tagSuggestions.style.top = `${inputRect.bottom + 4}px`;
                    tagSuggestions.style.left = `${inputRect.left}px`;
                    tagSuggestions.style.width = `${Math.min(inputRect.width, maxWidth)}px`;
                    tagSuggestions.style.display = 'block';
                    
                    matches.forEach(tag => {
                        const suggestion = tagSuggestions.createEl('div', {
                            cls: 'tag-suggestion',
                            text: tag.name
                        });
                        suggestion.onclick = () => {
                            selectedTags.add(tag.name);
                            tagInput.value = '';
                            tagSuggestions.style.display = 'none';
                            defaultTagsGrid.style.display = 'grid';
                            updateSelectedTags();
                            showDefaultTags();
                        };
                    });
                } else {
                    tagSuggestions.style.display = 'none';
                }
            } else {
                // 无输入时显示默认网格，隐藏搜索结果
                tagSuggestions.style.display = 'none';
                defaultTagsGrid.style.display = 'grid';
                showDefaultTags();
            }
        };
        
        // 处理回车事件
        tagInput.onkeydown = (e) => {
            if (e.key === 'Enter' && tagInput.value) {
                e.preventDefault();
                const value = tagInput.value.trim();
                if (value && !selectedTags.has(value)) {
                    const existingTag = this.tags.find(t => t.name.toLowerCase() === value.toLowerCase());
                    if (existingTag) {
                        selectedTags.add(existingTag.name);
                        updateSelectedTags();
                        showDefaultTags();
                    } else if (this.canCreateTags) {
                        selectedTags.add(value);
                        updateSelectedTags();
                        showDefaultTags();
                    } else {
                        // 显示权限提示
                        new Notice(t('PERMISSION_ERROR'), 3000);
                    }
                }
                tagInput.value = '';
                tagSuggestions.style.display = 'none';
                defaultTagsGrid.style.display = 'grid';
            }
        };
        
        // 处理失焦事件，隐藏建议
        tagInput.onblur = () => {
            // 延迟隐藏，以便可以点击建议
            setTimeout(() => {
                tagSuggestions.style.display = 'none';
                defaultTagsGrid.style.display = 'grid';
            }, 200);
        };
        
        // 处理窗口滚动，更新建议列表位置
        const updateSuggestionsPosition = () => {
            if (tagSuggestions.childNodes.length > 0) {
                const inputRect = tagInput.getBoundingClientRect();
                tagSuggestions.style.top = `${inputRect.bottom + 4}px`;
                tagSuggestions.style.left = `${inputRect.left}px`;
                tagSuggestions.style.width = `${inputRect.width}px`;
            }
        };
        
        // 监听滚动事件
        this.modalEl.addEventListener('scroll', updateSuggestionsPosition);
        
        // 模态框关闭时移除事件监听器
        this.modalEl.onclose = () => {
            this.modalEl.removeEventListener('scroll', updateSuggestionsPosition);
        };
        
        // 创建按钮区域
        const buttonArea = contentEl.createEl('div', { cls: 'button-area' });
        const submitButton = buttonArea.createEl('button', { 
            text: isUpdate ? t('UPDATE') : t('PUBLISH'),
            cls: 'submit-button'
        });
        
        submitButton.onclick = async () => {
            // 保存当前选择的标签到activeFile对象
            this.plugin.activeFile.tags = Array.from(selectedTags);
            
            // 禁用提交按钮，显示加载状态
            submitButton.disabled = true;
            submitButton.textContent = isUpdate ? t('UPDATING') : t('PUBLISHING');
            
            try {
                // 发布主题
                const result = await this.plugin.publishTopic();
                
                if (result.success) {
                    // 成功
                    new Notice(isUpdate ? t('UPDATE_SUCCESS') : t('PUBLISH_SUCCESS'), 5000);
                    
                    // 2秒后自动关闭
                    setTimeout(() => {
                        this.close();
                    }, 2000);
                } else {
                    // 失败 - 使用 Obsidian 原生 Notice
                    const errorMessage = (isUpdate ? t('UPDATE_ERROR') : t('PUBLISH_ERROR')) + 
                                       '\n' + (result.error || t('UNKNOWN_ERROR'));
                    new Notice(errorMessage, 8000);
                    
                    // 重置按钮状态
                    submitButton.disabled = false;
                    submitButton.textContent = isUpdate ? t('UPDATE') : t('PUBLISH');
                }
            } catch (error) {
                // 显示错误 - 使用 Obsidian 原生 Notice
                const errorMessage = (isUpdate ? t('UPDATE_ERROR') : t('PUBLISH_ERROR')) + 
                                   '\n' + (error.message || t('UNKNOWN_ERROR'));
                new Notice(errorMessage, 8000);
                
                // 重置按钮状态
                submitButton.disabled = false;
                submitButton.textContent = isUpdate ? t('UPDATE') : t('PUBLISH');
            }
        };
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// 分类冲突确认对话框
export class CategoryConflictModal extends Modal {
    plugin: PluginInterface;
    localCategoryId: number;
    localCategoryName: string;
    remoteCategoryId: number;
    remoteCategoryName: string;
    resolve: (useRemote: boolean) => void;

    constructor(
        app: App, 
        plugin: PluginInterface, 
        localCategoryId: number,
        localCategoryName: string,
        remoteCategoryId: number,
        remoteCategoryName: string
    ) {
        super(app);
        this.plugin = plugin;
        this.localCategoryId = localCategoryId;
        this.localCategoryName = localCategoryName;
        this.remoteCategoryId = remoteCategoryId;
        this.remoteCategoryName = remoteCategoryName;
    }

    // 返回一个Promise，让调用者等待用户选择
    showAndWait(): Promise<boolean> {
        return new Promise((resolve) => {
            this.resolve = resolve;
            this.open();
        });
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('discourse-category-conflict-modal');

        // 标题
        contentEl.createEl('h2', { text: t('CATEGORY_CONFLICT_TITLE') });

        // 说明文字
        const description = contentEl.createEl('div', { cls: 'conflict-description' });
        description.createEl('p', { text: t('CATEGORY_CONFLICT_DESC') });

        // 分类对比
        const comparisonContainer = contentEl.createEl('div', { cls: 'category-comparison' });
        
        // 本地分类
        const localContainer = comparisonContainer.createEl('div', { cls: 'category-option local' });
        localContainer.createEl('h3', { text: t('LOCAL_CATEGORY') });
        localContainer.createEl('div', { 
            cls: 'category-name',
            text: `${this.localCategoryName} (ID: ${this.localCategoryId})`
        });

        // 远程分类
        const remoteContainer = comparisonContainer.createEl('div', { cls: 'category-option remote' });
        remoteContainer.createEl('h3', { text: t('REMOTE_CATEGORY') });
        remoteContainer.createEl('div', { 
            cls: 'category-name',
            text: `${this.remoteCategoryName} (ID: ${this.remoteCategoryId})`
        });

        // 按钮区域
        const buttonArea = contentEl.createEl('div', { cls: 'button-area' });
        
        // 保持本地分类按钮
        const keepLocalButton = buttonArea.createEl('button', {
            cls: 'keep-local-button',
            text: t('KEEP_LOCAL_CATEGORY')
        });
        keepLocalButton.onclick = () => {
            this.resolve(false);
            this.close();
        };

        // 使用远程分类按钮
        const useRemoteButton = buttonArea.createEl('button', {
            cls: 'use-remote-button',
            text: t('USE_REMOTE_CATEGORY')
        });
        useRemoteButton.onclick = () => {
            this.resolve(true);
            this.close();
        };
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
        // 如果用户直接关闭对话框，默认保持本地设置
        if (this.resolve) {
            this.resolve(false);
        }
    }
}

// 论坛选择模态框
export class ForumSelectionModal extends Modal {
    plugin: PluginInterface;
    forumPresets: ForumPreset[];
    resolve: (forumPreset: ForumPreset | null) => void;

    constructor(app: App, plugin: PluginInterface, forumPresets: ForumPreset[]) {
        super(app);
        this.plugin = plugin;
        this.forumPresets = forumPresets;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('discourse-forum-selection-modal');

        // 标题
        contentEl.createEl('h2', { text: t('SELECT_FORUM_TITLE') });

        // 说明文字
        const description = contentEl.createEl('div', { cls: 'forum-selection-description' });
        description.createEl('p', { text: t('SELECT_FORUM_DESC') });

        // 论坛选项容器
        const forumsContainer = contentEl.createEl('div', { cls: 'forums-container' });

        // 如果没有启用多论坛或者没有预设，显示单论坛模式
        if (!this.plugin.settings.enableMultiForums || this.forumPresets.length === 0) {
            const singleForumOption = forumsContainer.createEl('div', { cls: 'forum-option single-forum' });
            
            const optionHeader = singleForumOption.createEl('div', { cls: 'forum-option-header' });
            optionHeader.createEl('div', { cls: 'forum-name', text: t('SINGLE_FORUM_MODE') });
            optionHeader.createEl('div', { cls: 'forum-url', text: this.plugin.settings.baseUrl });
            
            const selectButton = singleForumOption.createEl('button', {
                cls: 'forum-select-button',
                text: t('PUBLISH')
            });
            
            selectButton.onclick = () => {
                // 返回null表示使用单论坛模式
                this.resolve(null);
                this.close();
            };
        } else {
            // 显示多论坛选项
            this.forumPresets.forEach(preset => {
                const forumOption = forumsContainer.createEl('div', { cls: 'forum-option' });
                
                // 如果是当前选中的论坛，添加selected类
                if (this.plugin.settings.selectedForumId === preset.id) {
                    forumOption.addClass('selected');
                }
                
                const optionHeader = forumOption.createEl('div', { cls: 'forum-option-header' });
                optionHeader.createEl('div', { cls: 'forum-name', text: preset.name });
                optionHeader.createEl('div', { cls: 'forum-url', text: preset.baseUrl });
                
                const selectButton = forumOption.createEl('button', {
                    cls: 'forum-select-button',
                    text: t('PUBLISH')
                });
                
                selectButton.onclick = () => {
                    this.resolve(preset);
                    this.close();
                };
            });
        }

        // 取消按钮
        const buttonArea = contentEl.createEl('div', { cls: 'button-area' });
        const cancelButton = buttonArea.createEl('button', {
            cls: 'cancel-button',
            text: t('CANCEL')
        });
        cancelButton.onclick = () => {
            this.resolve(null);
            this.close();
        };
    }

    showAndWait(): Promise<ForumPreset | null> {
        return new Promise((resolve) => {
            this.resolve = resolve;
            this.open();
        });
    }
}

// 论坛预设编辑模态框
export class ForumPresetEditModal extends Modal {
    preset: ForumPreset;
    resolve: (preset: ForumPreset | null) => void;
    isNew: boolean;

    constructor(app: App, preset: ForumPreset, isNew = false) {
        super(app);
        this.preset = {...preset}; // 创建副本
        this.isNew = isNew;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('discourse-preset-edit-modal');

        // 标题
        contentEl.createEl('h2', { 
            text: this.isNew ? t('ADD_FORUM_PRESET') : t('EDIT') + ' ' + this.preset.name 
        });

        // 表单
        const form = contentEl.createDiv('preset-edit-form');

        // 论坛名称
        const nameGroup = form.createDiv('form-group');
        nameGroup.createEl('label', { text: t('EDIT_FORUM_NAME') });
        const nameInput = nameGroup.createEl('input', { type: 'text' });
        nameInput.value = this.preset.name;
        nameInput.placeholder = t('NEW_FORUM_PRESET');

        // 论坛地址
        const urlGroup = form.createDiv('form-group');
        urlGroup.createEl('label', { text: t('EDIT_FORUM_URL') });
        const urlInput = urlGroup.createEl('input', { type: 'url' });
        urlInput.value = this.preset.baseUrl;
        urlInput.placeholder = 'https://forum.example.com';

        // API密钥区域
        const apiSection = form.createDiv('form-group');
        apiSection.createEl('label', { text: t('USER_API_KEY') });
        const apiInput = apiSection.createEl('input', { type: 'text', attr: { readonly: 'readonly' } });
        apiInput.value = this.preset.userApiKey;
        apiInput.placeholder = t('USER_API_KEY');
        apiInput.style.fontFamily = 'monospace';
        apiInput.style.fontSize = '12px';
        apiInput.style.color = 'var(--text-muted)';
        apiInput.style.background = 'var(--background-secondary)';
        apiInput.style.width = '100%';
        apiInput.readOnly = true;
        // 跟随输入实时更新
        // apiInput.addEventListener('input', () => {
        //     apiPlain.value = apiInput.value;
        // });

        // 获取API Key按钮
        const getApiBtn = apiSection.createEl('button', {
            cls: 'get-api-btn',
            text: t('GENERATE_AUTH_LINK')
        });
        getApiBtn.onclick = async () => {
            const { generateKeyPairAndNonce, saveKeyPair } = await import("./crypto");
            const pair = generateKeyPairAndNonce();
            saveKeyPair(pair);
            const url = `${urlInput.value.replace(/\/$/,"")}/user-api-key/new?` +
                `application_name=Obsidian%20Discourse%20Plugin&client_id=obsidian-${Date.now()}&scopes=read,write&public_key=${encodeURIComponent(pair.publicKeyPem)}&nonce=${pair.nonce}`;
            window.open(url, '_blank');
            new Notice(t('AUTH_LINK_GENERATED'), 8000);
        };

        // 解密payload区域
        const decryptGroup = form.createDiv('form-group');
        decryptGroup.createEl('label', { text: t('DECRYPT_PAYLOAD') });
        const payloadInput = decryptGroup.createEl('input', { type: 'text' });
        payloadInput.placeholder = t('PAYLOAD_PLACEHOLDER');
        const decryptBtn = decryptGroup.createEl('button', {
            cls: 'decrypt-btn',
            text: t('DECRYPT_AND_SAVE')
        });
        decryptBtn.onclick = async () => {
            const { decryptUserApiKey, clearKeyPair } = await import("./crypto");
            const payload = payloadInput.value;
            if (!payload) { new Notice(t('PAYLOAD_PLACEHOLDER')); return; }
            try {
                const userApiKey = await decryptUserApiKey(payload);
                apiInput.value = userApiKey;
                this.preset.userApiKey = userApiKey;
                clearKeyPair();
                new Notice(t('DECRYPT_SUCCESS'), 5000);
            } catch (e) {
                new Notice(t('DECRYPT_FAILED') + e, 8000);
            }
        };

        // 按钮区域
        const buttonArea = contentEl.createDiv('button-area');
        // 保存按钮
        const saveButton = buttonArea.createEl('button', {
            cls: 'save-button',
            text: t('SAVE')
        });
        saveButton.onclick = () => {
            // 验证输入
            if (!nameInput.value.trim()) {
                nameInput.focus();
                return;
            }
            if (!urlInput.value.trim()) {
                urlInput.focus();
                return;
            }
            if (!apiInput.value.trim()) {
                apiInput.focus();
                return;
            }
            // 更新预设数据
            this.preset.name = nameInput.value.trim();
            this.preset.baseUrl = urlInput.value.trim().replace(/\/$/, '');
            this.preset.userApiKey = apiInput.value.trim();
            this.resolve(this.preset);
            this.close();
        };
        // 取消按钮
        const cancelButton = buttonArea.createEl('button', {
            cls: 'cancel-button',
            text: t('CANCEL')
        });
        cancelButton.onclick = () => {
            this.resolve(null);
            this.close();
        };
        nameInput.focus();
    }

    showAndWait(): Promise<ForumPreset | null> {
        return new Promise((resolve) => {
            this.resolve = resolve;
            this.open();
        });
    }
}
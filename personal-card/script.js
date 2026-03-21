// 头像上传功能
const avatarInput = document.getElementById('avatarInput');
const avatarImg = document.getElementById('avatarImg');

// 点击头像触发文件选择
avatarImg.addEventListener('click', () => {
    avatarInput.click();
});

// 处理文件选择
avatarInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        // 检查文件类型
        if (!file.type.startsWith('image/')) {
            alert('请选择图片文件！');
            return;
        }
        
        // 检查文件大小（限制5MB）
        if (file.size > 5 * 1024 * 1024) {
            alert('图片大小不能超过5MB！');
            return;
        }
        
        // 读取并显示图片
        const reader = new FileReader();
        reader.onload = (event) => {
            avatarImg.src = event.target.result;
            // 添加上传成功的视觉反馈
            avatarImg.style.transform = 'scale(1.1)';
            setTimeout(() => {
                avatarImg.style.transform = '';
            }, 200);
        };
        reader.readAsDataURL(file);
    }
});

// 可编辑内容的交互增强
document.querySelectorAll('[contenteditable="true"]').forEach(element => {
    // 聚焦时的样式
    element.addEventListener('focus', () => {
        element.classList.add('editing');
    });
    
    // 失焦时的样式
    element.addEventListener('blur', () => {
        element.classList.remove('editing');
    });
    
    // 防止Enter键换行（单行文本）
    if (element.tagName === 'H1' || element.tagName === 'LI') {
        element.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                element.blur();
            }
        });
    }
});

// 拖拽上传头像
const avatarContainer = document.querySelector('.avatar');

avatarContainer.addEventListener('dragover', (e) => {
    e.preventDefault();
    avatarContainer.classList.add('drag-over');
});

avatarContainer.addEventListener('dragleave', () => {
    avatarContainer.classList.remove('drag-over');
});

avatarContainer.addEventListener('drop', (e) => {
    e.preventDefault();
    avatarContainer.classList.remove('drag-over');
    
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
            avatarImg.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }
});
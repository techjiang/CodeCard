import { describe, expect, test } from 'vitest'
import { mount } from '@vue/test-utils'
import { useCardEditor } from '@/composables/useCardEditor'
import CardEditor from '@/components/editor/CardEditor.vue'
import ContentInput from '@/components/editor/ContentInput.vue'
import StylePanel from '@/components/editor/StylePanel.vue'
import TagInput from '@/components/editor/TagInput.vue'

describe('编辑器 UI', () => {
  test('输入标题实时更新 store', async () => {
    const store = useCardEditor()
    const wrapper = mount(CardEditor, { props: { store } })
    const input = wrapper.find('#cc-title')
    await input.setValue('新的标题')
    expect(store.card.title).toBe('新的标题')
  })

  test('切换卡片类型显示对应编辑器', async () => {
    const store = useCardEditor()
    const wrapper = mount(ContentInput, { props: { card: store.card } })
    expect(wrapper.find('#cc-content').exists()).toBe(true)
    await wrapper.findAll('.type-btn')[1].trigger('click') // 代码片段
    expect(store.card.type).toBe('code')
    expect(wrapper.find('#cc-filename').exists()).toBe(true)
    await wrapper.findAll('.type-btn')[4].trigger('click') // 名言金句
    expect(wrapper.find('#cc-quote-from').exists()).toBe(true)
  })

  test('标签最多 5 个', async () => {
    let tags = ['a', 'b', 'c', 'd', 'e']
    const wrapper = mount(TagInput, {
      props: {
        tags,
        onAdd: (v: string) => {
          if (tags.length < 5) tags = [...tags, v]
        },
        onRemove: (v: string) => (tags = tags.filter((t) => t !== v)),
      },
    })
    const input = wrapper.find('input')
    expect(input.attributes('disabled')).toBeDefined()
    await wrapper.findAll('.tag__x')[0].trigger('click')
    expect(tags.length).toBe(4)
  })

  test('样式面板可切尺寸与模板', async () => {
    const store = useCardEditor()
    const wrapper = mount(StylePanel, {
      props: { style: store.style, cardType: store.card.type, favorites: [] },
    })
    await wrapper.findAll('.size-btn')[1].trigger('click')
    expect(wrapper.emitted('update:size-preset')?.[0]).toEqual(['landscape'])
    await wrapper.findAll('.tpl')[0].trigger('click')
    expect(wrapper.emitted('update:template')?.length).toBe(1)
    await wrapper.find('.ghost-btn').trigger('click')
    expect(wrapper.emitted('randomize')).toBeTruthy()
  })

  /**
   * 面板改样式必须抛事件给父级。
   *
   * 曾经的写法是 `props.style.borderRadius = r` —— 读得到、写不进去（props 代理里是份拷贝），
   * 按钮状态变了、卡片纹丝不动：圆角、透明度、水印整组开关全是摆设。
   */
  test('样式面板的改动都通过 update:style 抛给父级', async () => {
    const store = useCardEditor()
    const wrapper = mount(StylePanel, {
      props: { style: store.style, cardType: store.card.type, favorites: [] },
    })

    await wrapper.findAll('.seg--wide button')[3].trigger('click') // 24px
    expect(wrapper.emitted('update:style')![wrapper.emitted('update:style')!.length - 1]).toEqual([{ borderRadius: 24 }])

    await wrapper.findAll('input[type="range"]')[0].setValue('40')
    expect(wrapper.emitted('update:style')![wrapper.emitted('update:style')!.length - 1]).toEqual([{ backgroundOpacity: 40 }])

    // 水印开关只在勾上之后才渲染文本输入，所以单独找一个面板实例验
    const wmPanel = mount(StylePanel, {
      props: { style: { ...store.style, watermark: { enabled: false, position: 'bottom-right', text: '' } }, cardType: 'knowledge', favorites: [] },
    })
    await wmPanel.find('input.switch').setValue(true)
    expect(wmPanel.emitted('update:style')![wmPanel.emitted('update:style')!.length - 1]).toEqual([
      { watermark: { enabled: true, position: 'bottom-right', text: '' } },
    ])
  })

  test('父级收到 update:style 后样式真的变了', async () => {
    const store = useCardEditor()
    const wrapper = mount(StylePanel, {
      props: {
        style: store.style,
        cardType: store.card.type,
        favorites: [],
        'onUpdate:style': (part: Partial<typeof store.style>) => store.patchStyle(part),
      },
    })
    await wrapper.findAll('.seg--wide button')[0].trigger('click') // 0px
    expect(store.style.borderRadius).toBe(0)
  })
})

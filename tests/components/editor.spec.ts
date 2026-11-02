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
})

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  PanResponder,
  Animated,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface Props {
  data: any[];
  renderItem: (item: any, dragTrigger: any) => React.ReactNode;
  onReorder: (newData: any[]) => void;
  itemHeight: number;
  onDragStateChange?: (isDragging: boolean) => void;
}

export const JSReorderList = ({ data, renderItem, onReorder, itemHeight, onDragStateChange }: Props) => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number>(-1);
  const panY = useRef(new Animated.Value(0)).current;
  
  const activeIdRef = useRef<string | null>(null);
  const originalIndexRef = useRef<number>(-1);

  const onDragStart = (id: string) => {
    const idx = data.findIndex(d => d.id === id);
    originalIndexRef.current = idx;
    activeIdRef.current = id;
    setActiveId(id);
    setHoverIndex(idx);
    panY.setValue(0);
    onDragStateChange?.(true);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => !!activeIdRef.current,
      onPanResponderMove: (_, gesture) => {
        if (!activeIdRef.current) return;
        panY.setValue(gesture.dy);

        // Calculate current "virtual" index based on dy
        const indexChange = Math.round(gesture.dy / itemHeight);
        const targetIndex = Math.max(0, Math.min(data.length - 1, originalIndexRef.current + indexChange));
        
        if (targetIndex !== hoverIndex) {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setHoverIndex(targetIndex);
        }
      },
      onPanResponderRelease: () => {
        if (!activeIdRef.current) return;
        
        // Calculate final position
        const dy = (panY as any)._value;
        const indexChange = Math.round(dy / itemHeight);
        const targetIndex = Math.max(0, Math.min(data.length - 1, originalIndexRef.current + indexChange));

        if (targetIndex !== originalIndexRef.current) {
          const newData = [...data];
          const [removed] = newData.splice(originalIndexRef.current, 1);
          newData.splice(targetIndex, 0, removed);
          onReorder(newData);
        }

        activeIdRef.current = null;
        setActiveId(null);
        setHoverIndex(-1);
        panY.setValue(0);
        onDragStateChange?.(false);
      },
      onPanResponderTerminate: () => {
        activeIdRef.current = null;
        setActiveId(null);
        setHoverIndex(-1);
        panY.setValue(0);
        onDragStateChange?.(false);
      }
    })
  ).current;

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      {data.map((item, index) => {
        const isActive = activeId === item.id;
        
        // Calculate shift for other items
        let translateY = 0;
        if (activeId && !isActive) {
          if (index > originalIndexRef.current && index <= hoverIndex) {
            translateY = -itemHeight; // Shift up
          } else if (index < originalIndexRef.current && index >= hoverIndex) {
            translateY = itemHeight; // Shift down
          }
        }

        return (
          <Animated.View
            key={item.id}
            style={[
              { height: itemHeight },
              isActive ? {
                zIndex: 999,
                transform: [{ translateY: panY }, { scale: 1.05 }],
                shadowColor: '#000',
                shadowOpacity: 0.3,
                shadowRadius: 15,
                elevation: 20,
              } : {
                zIndex: 1,
                transform: [{ translateY: translateY }],
              },
            ]}
          >
            {renderItem(item, () => onDragStart(item.id))}
          </Animated.View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: 100,
  },
});

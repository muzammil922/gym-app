import React from 'react';
import { Text, View } from 'react-native';
import { Button } from '@/src/components/ui/Button';

type Props = { children: React.ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            backgroundColor: '#0A1211',
          }}
        >
          <Text
            style={{
              fontSize: 18,
              fontWeight: '700',
              marginBottom: 8,
              color: '#FFFFFF',
            }}
          >
            Unexpected error
          </Text>
          <Text
            style={{
              textAlign: 'center',
              marginBottom: 16,
              color: 'rgba(255,255,255,0.65)',
            }}
          >
            {this.state.error.message}
          </Text>
          <Button title="Try again" onPress={() => this.setState({ error: null })} />
        </View>
      );
    }
    return this.props.children;
  }
}
